import getPool from "../../config/database.js";
import { errorResponse, successResponse } from "../../helper/response.js";
import { keysToCamelCase } from "../../utils/common.js";

export async function createLeadLostReason(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.user_id;

    let { lost_reason, sort_order, is_active } = req.body;

    await client.query("BEGIN");

    const duplicateCheck = await client.query(
      `
        SELECT lead_lost_reason_id
        FROM lead_lost_reason
        WHERE builder_id = $1
          AND LOWER(lost_reason) = LOWER($2)
      `,
      [builderId, lost_reason],
    );

    if (duplicateCheck.rowCount > 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "Lost reason already exists.");
    }

    if (sort_order === undefined || sort_order === null) {
      sort_order = 1;
    }

    const maxSortOrderQuery = `
      SELECT COALESCE(MAX(sort_order), 0) AS max_sort_order
      FROM lead_lost_reason
      WHERE
        (
          (company_id = $1 AND $1 IS NOT NULL)
          OR
          (builder_id = $2 AND $2 IS NOT NULL)
        )
    `;

    const maxSortOrderResult = await client.query(maxSortOrderQuery, [
      companyId,
      builderId,
    ]);

    const maxSortOrder = maxSortOrderResult.rows[0].max_sort_order;

    if (sort_order < 1 || sort_order > maxSortOrder + 1) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        `Invalid sort_order. Allowed range is 1 to ${maxSortOrder + 1}.`,
      );
    }

    const shiftSortOrderQuery = `
      UPDATE lead_lost_reason
      SET sort_order = sort_order + 1
      WHERE sort_order >= $1
        AND (
          (company_id = $2 AND $2 IS NOT NULL)
          OR
          (builder_id = $3 AND $3 IS NOT NULL)
        )
    `;

    await client.query(shiftSortOrderQuery, [sort_order, companyId, builderId]);

    const insertQuery = `
      INSERT INTO lead_lost_reason (
        company_id,
        builder_id,
        lost_reason,
        sort_order,
        is_active,
        created_by,
        updated_by
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING *;
    `;

    const result = await client.query(insertQuery, [
      companyId,
      builderId,
      lost_reason,
      sort_order,
      is_active ?? true,
      userId,
      userId,
    ]);

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Lead lost reason created successfully.",
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error creating lead lost reason:", err);
    return errorResponse(res, 500, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
}

export async function getAllLeadLostReasons(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    let { page = 1, limit = 25 } = req.query;

    page = parseInt(page);
    limit = parseInt(limit);
    const offset = (page - 1) * limit;

    const countResult = await client.query(
      `
        SELECT COUNT(*) AS total
        FROM lead_lost_reason
        WHERE company_id = $1 AND builder_id = $2
      `,
      [companyId, builderId],
    );

    const total = parseInt(countResult.rows[0].total);
    const result = await client.query(
      `
        SELECT 
         *
        FROM lead_lost_reason
        WHERE company_id = $1 AND builder_id = $2
        ORDER BY sort_order ASC
        LIMIT $3 OFFSET $4
      `,
      [companyId, builderId, limit, offset],
    );

    return successResponse(res, {
      leadLostReason: keysToCamelCase(result.rows),
      pagination: {
        totalRecords: total,
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        limit,
      },
    });
  } catch (err) {
    console.error("Error fetching lead lost reasons:", err);
    return errorResponse(res, 500, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
}

export async function deleteLeadLostReason(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const builderId = req.user.builder_id;

    if (!id) {
      return errorResponse(res, 400, " ID is required.");
    }
    const existingSurveyor = await client.query(
      "SELECT lead_lost_reason, sort_order FROM lead_lost_reason WHERE lead_lost_reason_id = $1 AND builder_id = $2",
      [id, builderId],
    );

    if (existingSurveyor.rowCount === 0) {
      return errorResponse(
        res,
        404,
        "lead lost reason not found for this builder.",
      );
    }

    const deletedSortOrder = existingSurveyor.rows[0].sort_order;

    await client.query(
      "DELETE FROM lead_lost_reason WHERE lead_lost_reason_id = $1",
      [id],
    );

    await client.query(
      "UPDATE lead_lost_reason SET sort_order = sort_order - 1 WHERE sort_order > $1 AND builder_id = $2",
      [deletedSortOrder, builderId],
    );

    return successResponse(res, null, "lead lost reason deleted successfully.");
  } catch (error) {
    console.error("Error deleting surveyor:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
}

export async function updateLeadLostReason(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.user_id;

    const { lost_reason, sort_order } = req.body;

    // const updatingOtherFields = lost_reason || sort_order !== undefined;

    await client.query("BEGIN");

    const record = await client.query(
      `
      SELECT lost_reason, is_active 
      FROM lead_lost_reason
      WHERE lead_lost_reason_id = $1
        AND company_id = $2
        AND builder_id = $3
      `,
      [id, companyId, builderId],
    );

    if (record.rows.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Lead lost not found.");
    }

    const activeRecord = await client.query(
      `
      SELECT lost_reason, is_active 
      FROM lead_lost_reason
      WHERE lead_lost_reason_id = $1
        AND company_id = $2
        AND builder_id = $3
        AND is_active = true
      `,
      [id, companyId, builderId],
    );

    if (activeRecord.rows.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Inactive lead lost reason.");
    }

    if (!lost_reason && sort_order === undefined) {
      return errorResponse(
        res,
        400,
        "At least one field must be provided to update.",
      );
    }

    if (lost_reason) {
      const dupCheck = await client.query(
        `
        SELECT lead_lost_reason_id 
        FROM lead_lost_reason
        WHERE (company_id = $1 AND builder_id = $2)
          AND LOWER(lost_reason) = LOWER($3)
          AND lead_lost_reason_id <> $4
        `,
        [companyId, builderId, lost_reason, id],
      );

      if (dupCheck.rows.length > 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Lost reason already exists.");
      }
    }

    if (sort_order !== undefined && sort_order !== null) {
      const existingSortOrderResult = await client.query(
        "SELECT sort_order FROM lead_lost_reason WHERE lead_lost_reason_id = $1",
        [id],
      );
      const existingSortOrder = existingSortOrderResult.rows[0].sort_order;

      const maxSortOrderQuery = `
    SELECT COALESCE(MAX(sort_order), 0) AS max_sort_order
    FROM lead_lost_reason
    WHERE builder_id = $1
  `;
      const maxSortOrderResult = await client.query(maxSortOrderQuery, [
        builderId,
      ]);
      const maxSortOrder = maxSortOrderResult.rows[0].max_sort_order;

      if (sort_order < 1 || sort_order > maxSortOrder) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          `Invalid sort_order. Allowed range is 1 to ${maxSortOrder}.`,
        );
      }

      if (sort_order !== existingSortOrder) {
        if (sort_order > existingSortOrder) {
          await client.query(
            `
        UPDATE lead_lost_reason
        SET sort_order = sort_order - 1
        WHERE sort_order > $1
          AND sort_order <= $2
          AND lead_lost_reason_id != $3
          AND builder_id = $4
        `,
            [existingSortOrder, sort_order, id, builderId],
          );
        } else {
          await client.query(
            `
        UPDATE lead_lost_reason
        SET sort_order = sort_order + 1
        WHERE sort_order >= $1
          AND sort_order < $2
          AND lead_lost_reason_id != $3
          AND builder_id = $4
        `,
            [sort_order, existingSortOrder, id, builderId],
          );
        }
      }
    }

    const updates = [];
    const values = [];
    let idx = 1;

    if (lost_reason) {
      updates.push(`lost_reason = $${idx++}`);
      values.push(lost_reason);
    }

    if (sort_order !== undefined) {
      // Check for !== undefined
      updates.push(`sort_order = $${idx++}`);
      values.push(sort_order);
    }

    updates.push(`updated_by = $${idx++}`);
    values.push(userId);

    updates.push("updated_at = NOW()");

    const updateQuery = `
      UPDATE lead_lost_reason
      SET ${updates.join(", ")}
      WHERE lead_lost_reason_id = $${idx}
        AND company_id = $${idx + 1}
        AND builder_id = $${idx + 2}
      RETURNING *;
    `;

    values.push(id, companyId, builderId);

    const result = await client.query(updateQuery, values);

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Lead lost reason updated successfully.",
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error updating lead lost reason:", err);
    return errorResponse(res, 500, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
}

export async function updateLeadLostReasonIsActive(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const userId = req.user?.user_id;
    const { id } = req.params;
    const { is_active } = req.body;

    if (!id) {
      return errorResponse(res, 400, "lead lost reason id is required");
    }

    if (typeof is_active !== "boolean") {
      return errorResponse(
        res,
        400,
        "is_active must be boolean (true or false)",
      );
    }

    const existing = await client.query(
      `
      SELECT lead_lost_reason_id
      FROM lead_lost_reason
      WHERE lead_lost_reason_id = $1
        AND builder_id = $2
      `,
      [id, builderId],
    );

    if (existing.rowCount === 0) {
      return errorResponse(
        res,
        404,
        "lead lost reason not found for this builder",
      );
    }

    const updateQuery = `
      UPDATE lead_lost_reason
      SET
        is_active = $1,
        updated_by = $2,
        updated_at = NOW()
      WHERE lead_lost_reason_id = $3
      RETURNING *;
    `;

    const updated = await client.query(updateQuery, [is_active, userId, id]);

    return successResponse(
      res,
      keysToCamelCase(updated.rows[0]),
      "lead lost reason status updated successfully.",
    );
  } catch (error) {
    console.error("Error updating lead source is_active:", error);
    return errorResponse(res, 500, error?.message || "Internal Server Error");
  } finally {
    client.release();
  }
}
