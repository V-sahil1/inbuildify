const getPool = require("../config/database");
const { successResponse, errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");
const { generateInvoiceCode } = require("../helper/codeGenerator");

exports.createInvoice = async (req, res) => {
  const builderId = req.user.builder_id;
  const creatorName = req.user.name || "User";
  const {
    description,
    notes,
    invoice_amount = 0,
    due_date,
    status = "draft",
    version_number = 1,
  } = req.body;
  const lead_id = req.params.lead_id;

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    if (lead_id) {
      const leadRes = await client.query(
        `SELECT lead_id FROM leads WHERE lead_id = $1 AND builder_id = $2 AND is_deleted = false`,
        [lead_id, builderId]
      );
      if (leadRes.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 404, "Lead not found.");
      }
    }

    const leadInvoiceId = generateInvoiceCode(creatorName, "invoice", version_number);

    const insertQuery = `
      INSERT INTO invoice (
        lead_invoice_id, builder_id, lead_id, description, notes,
        invoice_amount, due_date, status, version_number
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9
      ) RETURNING *
    `;

    const values = [
      leadInvoiceId,
      builderId,
      lead_id,
      description,
      notes,
      invoice_amount,
      due_date,
      status,
      version_number,
    ];

    const result = await client.query(insertQuery, values);
    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Invoice created successfully."
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Create invoice error:", error);
    if (error.code === "23505") {
      return errorResponse(res, 409, "Duplicate invoice code.");
    }
    return errorResponse(res, 500, "Failed to create invoice.");
  } finally {
    client.release();
  }
};

exports.getInvoices = async (req, res) => {
  const builderId = req.user.builder_id;
  const lead_id = req.params.lead_id;
  const { limit = 25, offset = 0, status } = req.query;

  const pool = getPool();
  const client = await pool.connect();

  try {
    let where = [`builder_id = $1`, `is_deleted = false`];
    const params = [builderId];
    let idx = 2;

    if (lead_id) {
      where.push(`lead_id = $${idx++}`);
      params.push(lead_id);
    }
    if (status) {
      where.push(`status = $${idx++}`);
      params.push(status);
    }

    const query = `
      SELECT *
        FROM invoice
       WHERE ${where.join(" AND ")}
       ORDER BY created_at DESC
       LIMIT $${idx++} OFFSET $${idx}
    `;
    params.push(limit, offset);

    const result = await client.query(query, params);
    return successResponse(
      res,
      keysToCamelCase(result.rows),
      "Invoices fetched successfully."
    );
  } catch (error) {
    console.error("Get invoices error:", error);
    return errorResponse(res, 500, "Failed to fetch invoices.");
  } finally {
    client.release();
  }
};
