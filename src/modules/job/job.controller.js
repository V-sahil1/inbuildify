import getPool from "../../config/database.js";
import { successResponse, errorResponse } from "../../helper/response.js";
import { keysToCamelCase } from "../../utils/common.js";

// ──────────────────────────────────────────────────────────────────────────────
//  GET /job  — paginated, filtered, sorted job list
// ──────────────────────────────────────────────────────────────────────────────
export async function getAllJobs(req, res) {
  const builderId = req.user?.builder_id;
  const companyId = req.user?.company_id;

  if (!builderId && !companyId) {
    return errorResponse(res, 401, "Unauthorized: Builder or company ID missing");
  }

  const pool = getPool();

  try {
    const toArray = (value) => {
      if (!value) return undefined;
      if (Array.isArray(value)) return value;
      return String(value).split(",").map((s) => s.trim()).filter(Boolean);
    };

    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit) || 25));
    const offset = (page - 1) * limit;

    const {
      search,
      status,
      reference_id,
      customer_name,
      job_address,
      estate_name,
      consultant,
      created_at_from,
      created_at_to,
      title_date_from,
      title_date_to,
      assignee_id,
      sort_by    = "created_at",
      sort_order = "desc",
    } = req.query;

    const statusList   = toArray(status);
    const assigneeList = toArray(assignee_id);

    // ── Tenant scope — use j.builder_id / j.company_id directly ─────────────
    // These columns are populated by the migration from the leads chain, so
    // every job row carries its own tenant IDs.  This avoids the fragile
    // opportunity → leads JOIN that could silently drop rows when opportunity_id
    // is NULL or the FK chain is broken.
    const conditions = [
      "(j.builder_id = $1 OR (j.company_id = $2 AND $2 IS NOT NULL))",
    ];
    const params = [builderId, companyId];
    let idx = 3;

    // ── Column-level filters ─────────────────────────────────────────────────
    if (statusList?.length) {
      conditions.push(`j.status = ANY($${idx++})`);
      params.push(statusList);
    }

    if (reference_id) {
      conditions.push(`j.reference_number ILIKE $${idx++}`);
      params.push(`%${reference_id}%`);
    }

    if (customer_name) {
      conditions.push(`l.name ILIKE $${idx++}`);
      params.push(`%${customer_name}%`);
    }

    if (job_address) {
      const p1 = idx++, p2 = idx++, p3 = idx++, p4 = idx++;
      conditions.push(`(
        pd.lot_number       ILIKE $${p1}
        OR pd.street        ILIKE $${p2}
        OR pd.address_line1 ILIKE $${p3}
        OR pd.city          ILIKE $${p4}
      )`);
      const term = `%${job_address}%`;
      params.push(term, term, term, term);
    }

    if (estate_name) {
      conditions.push(`pd.estate_name ILIKE $${idx++}`);
      params.push(`%${estate_name}%`);
    }

    if (consultant) {
      conditions.push(`u.name ILIKE $${idx++}`);
      params.push(`%${consultant}%`);
    }

    if (assigneeList?.length) {
      conditions.push(`l.assignee_id = ANY($${idx++}::uuid[])`);
      params.push(assigneeList);
    }

    if (created_at_from) {
      conditions.push(`j.created_at >= $${idx++}`);
      params.push(created_at_from);
    }

    if (created_at_to) {
      conditions.push(`j.created_at <= $${idx++}`);
      params.push(created_at_to);
    }

    if (title_date_from) {
      conditions.push(`pd.title_date >= $${idx++}`);
      params.push(title_date_from);
    }

    if (title_date_to) {
      conditions.push(`pd.title_date <= $${idx++}`);
      params.push(title_date_to);
    }

    // ── Global full-text search ───────────────────────────────────────────────
    if (search) {
      const p1 = idx++, p2 = idx++, p3 = idx++, p4 = idx++, p5 = idx++, p6 = idx++;
      conditions.push(`(
        j.reference_number ILIKE $${p1}
        OR l.name          ILIKE $${p2}
        OR l.email         ILIKE $${p3}
        OR l.phone         ILIKE $${p4}
        OR pd.estate_name  ILIKE $${p5}
        OR u.name          ILIKE $${p6}
      )`);
      const term = `%${search}%`;
      params.push(term, term, term, term, term, term);
    }

    const whereClause = conditions.join(" AND ");

    // ── Sorting ───────────────────────────────────────────────────────────────
    const allowedSort = {
      created_at:    "j.created_at",
      updated_at:    "j.updated_at",
      reference_id:  "j.reference_number",
      customer_name: "l.name",
      status:        "j.status",
      title_date:    "pd.title_date",
      estate_name:   "pd.estate_name",
    };
    const orderCol = allowedSort[sort_by] || "j.created_at";
    const orderDir = String(sort_order).toLowerCase() === "asc" ? "ASC" : "DESC";

    // ── FROM / JOIN ───────────────────────────────────────────────────────────
    // builder_id / company_id scoping uses j.* columns directly, so the leads
    // JOIN is only needed for display fields (name, email, phone, assignee, address).
    const fromClause = `
      FROM job j
      JOIN opportunity          o  ON j.opportunity_id      = o.opportunity_id
      JOIN leads                l  ON o.leads_id             = l.leads_id
      LEFT JOIN property_detail pd ON l.property_detail_id  = pd.property_detail_id
      LEFT JOIN state           st ON pd.state_id            = st.state_id
      LEFT JOIN users           u  ON l.assignee_id          = u.users_id
    `;

    // ── Main data query ───────────────────────────────────────────────────────
    const dataSQL = `
      SELECT
        j.job_id,
        j.reference_number,
        j.status,
        j.job_note,
        j.builder_id,
        j.company_id,
        j.created_at,
        j.updated_at,
        l.leads_id,
        l.name                              AS customer_name,
        l.email                             AS customer_email,
        l.phone                             AS customer_phone,
        pd.estate_name,
        pd.title_date,
        COALESCE(
          NULLIF(TRIM(
            CONCAT_WS(', ',
              NULLIF(TRIM(COALESCE(pd.lot_number,    '')), ''),
              NULLIF(TRIM(COALESCE(pd.street,        '')), ''),
              NULLIF(TRIM(COALESCE(pd.address_line1, '')), ''),
              NULLIF(TRIM(COALESCE(pd.address_line2, '')), ''),
              NULLIF(TRIM(COALESCE(pd.city,          '')), ''),
              NULLIF(TRIM(COALESCE(st.name,          '')), ''),
              NULLIF(TRIM(COALESCE(pd.zip_code,      '')), '')
            )
          ), ''),
          'N/A'
        )                                   AS job_address,
        u.users_id                          AS consultant_id,
        u.name                              AS consultant_name,
        u.initials                          AS consultant_initials,
        u.email                             AS consultant_email
      ${fromClause}
      WHERE ${whereClause}
      ORDER BY ${orderCol} ${orderDir} NULLS LAST
      LIMIT $${idx++} OFFSET $${idx++}
    `;
    params.push(limit, offset);

    // Count query shares the same WHERE (strip the LIMIT/OFFSET params)
    const countSQL = `
      SELECT COUNT(*) AS total
      ${fromClause}
      WHERE ${whereClause}
    `;
    const countParams = params.slice(0, -2);

    // ── Status summary (full tenant, ignores active filters) ─────────────────
    // Scoped directly via j.builder_id / j.company_id — no JOIN needed.
    const statsSQL = `
      SELECT j.status, COUNT(*) AS count
      FROM job j
      WHERE (j.builder_id = $1 OR (j.company_id = $2 AND $2 IS NOT NULL))
      GROUP BY j.status
    `;

    // ── Total job count for the widget ────────────────────────────────────────
    const totalJobsSQL = `
      SELECT COUNT(*) AS total
      FROM job j
      WHERE (j.builder_id = $1 OR (j.company_id = $2 AND $2 IS NOT NULL))
    `;

    const [dataResult, countResult, statsResult, totalResult] = await Promise.all([
      pool.query(dataSQL,        params),
      pool.query(countSQL,       countParams),
      pool.query(statsSQL,       [builderId, companyId]),
      pool.query(totalJobsSQL,   [builderId, companyId]),
    ]);

    const total      = parseInt(countResult.rows[0]?.total || 0);
    const totalPages = Math.ceil(total / limit);
    const totalJobs  = parseInt(totalResult.rows[0]?.total || 0);

    const statusSummary = {
      "In Progress": 0,
      "Completed":   0,
      "On Hold":     0,
      "Cancelled":   0,
      "Archived":    0,
    };
    for (const row of statsResult.rows) {
      if (Object.prototype.hasOwnProperty.call(statusSummary, row.status)) {
        statusSummary[row.status] = parseInt(row.count);
      }
    }

    return successResponse(res, {
      jobs: keysToCamelCase(dataResult.rows),
      pagination: { page, limit, total, totalPages },
      statusSummary,
      totalJobs,
    }, "Jobs fetched successfully");

  } catch (error) {
    console.error("getAllJobs error:", error);
    return errorResponse(res, 500, "Internal server error");
  }
}

// ──────────────────────────────────────────────────────────────────────────────
//  POST /job/opportunity/:opportunity_id/convert
// ──────────────────────────────────────────────────────────────────────────────
export async function convertOpportunityToJob(req, res) {
  const { opportunity_id } = req.params;
  const {
    out_come,
    quotation_version_id,
    job_note,
    send_email,
    lead_lost_reason_id,
    lead_lost_comment,
  } = req.body;

  const pool   = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Fetch opportunity + lead details in one query so we have builder/company
    const oppResult = await client.query(
      `SELECT
         o.opportunity_id,
         o.status,
         o.outcome,
         l.reference_number,
         l.leads_id,
         l.builder_id,
         l.company_id
       FROM opportunity o
       JOIN leads l ON o.leads_id = l.leads_id
       WHERE o.opportunity_id = $1`,
      [opportunity_id],
    );

    if (oppResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Opportunity not found");
    }
    const opportunity = oppResult.rows[0];

    // ── Lost ─────────────────────────────────────────────────────────────────
    if (out_come === "lost") {
      await client.query(
        "UPDATE opportunity SET status = 'Close', outcome = 'lost', updated_at = NOW() WHERE opportunity_id = $1",
        [opportunity_id],
      );
      await client.query(
        `UPDATE leads SET lead_lost_reason_id = $1, lead_lost_comment = $2, updated_at = NOW() WHERE leads_id = $3`,
        [lead_lost_reason_id, lead_lost_comment || null, opportunity.leads_id],
      );
      await client.query("COMMIT");
      return successResponse(res, {}, "Opportunity marked as lost and closed.");
    }

    // ── Won ──────────────────────────────────────────────────────────────────
    if (out_come === "won") {
      const jobCheck = await client.query(
        "SELECT job_id FROM job WHERE opportunity_id = $1",
        [opportunity_id],
      );
      if (jobCheck.rowCount > 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "A job already exists for this opportunity.");
      }
      if (!quotation_version_id) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Quotation version ID is required when status is WON");
      }
      const qvCheck = await client.query(
        "SELECT quotation_version_id FROM quotation_version WHERE quotation_version_id = $1 AND is_approve = true",
        [quotation_version_id],
      );
      if (qvCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 404, "Quotation version not found or not approved");
      }

      await client.query(
        "UPDATE opportunity SET status = 'Close', outcome = $1, updated_at = NOW() WHERE opportunity_id = $2",
        ["won", opportunity_id],
      );

      // Insert job with all tenant-scoping fields populated from the lead.
      const jobResult = await client.query(
        `INSERT INTO job
           (reference_number, opportunity_id, quotation_version_id,
            job_note, send_email, status, builder_id, company_id,
            created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, 'In Progress', $6, $7, now(), now())
         RETURNING *`,
        [
          opportunity.reference_number,
          opportunity_id,
          quotation_version_id,
          job_note   || null,
          send_email || false,
          opportunity.builder_id,
          opportunity.company_id,
        ],
      );

      await client.query("COMMIT");
      return successResponse(
        res,
        keysToCamelCase(jobResult.rows[0]),
        "Opportunity converted to job successfully.",
      );
    }

    await client.query("ROLLBACK");
    return errorResponse(res, 400, "Invalid out_come value. Must be 'won' or 'lost'.");

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Convert opportunity to job error:", error);
    return errorResponse(res, 500, "Internal server error");
  } finally {
    client.release();
  }
}

// ──────────────────────────────────────────────────────────────────────────────
//  PATCH /job/:job_id/status
// ──────────────────────────────────────────────────────────────────────────────
export async function updateJobStatus(req, res) {
  const { job_id } = req.params;
  const { status } = req.body;
  const builderId  = req.user?.builder_id;
  const companyId  = req.user?.company_id;

  const VALID_STATUSES = ["In Progress", "Completed", "On Hold", "Cancelled", "Archived"];
  if (!VALID_STATUSES.includes(status)) {
    return errorResponse(res, 400, `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`);
  }

  const pool = getPool();
  try {
    // Scoped directly via j.builder_id / j.company_id — no JOIN needed.
    const result = await pool.query(
      `UPDATE job
       SET status = $1, updated_at = NOW()
       WHERE job_id = $2
         AND (builder_id = $3 OR (company_id = $4 AND $4 IS NOT NULL))
       RETURNING *`,
      [status, job_id, builderId, companyId],
    );
    if (result.rowCount === 0) {
      return errorResponse(res, 404, "Job not found or unauthorised");
    }
    return successResponse(res, keysToCamelCase(result.rows[0]), "Job status updated");
  } catch (error) {
    console.error("updateJobStatus error:", error);
    return errorResponse(res, 500, "Internal server error");
  }
}
