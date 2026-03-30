import getPool from "../../config/database.js";
import { successResponse, errorResponse } from "../../helper/response.js";
import { keysToCamelCase } from "../../utils/common.js";

export async function createSms(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { leads_id, recipient_id, message } = req.body;

    const leadCheck = await client.query(
      "SELECT leads_id FROM leads WHERE leads_id = $1",
      [leads_id],
    );

    if (leadCheck.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "Invalid leads_id. Lead not found.");
    }

    if (recipient_id) {
      const recipientCheck = await client.query(
        "SELECT users_id FROM users WHERE users_id = $1 AND is_deleted = false",
        [recipient_id],
      );

      if (recipientCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "Invalid recipient_id. User not found or deleted.",
        );
      }
    }

    const insertQuery = `
      INSERT INTO sms (leads_id, recipient_id, message, created_at, updated_at)
      VALUES ($1, $2, $3, NOW(), NOW())
      RETURNING *
    `;

    const result = await client.query(insertQuery, [
      leads_id,
      recipient_id || null,
      message,
    ]);

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "SMS created successfully.",
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error creating SMS:", err);
    return errorResponse(res, 500, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
}

export async function getAllSms(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { leads_id, recipient_id, page = 1, limit = 25 } = req.query;

    const pageValue = parseInt(page, 10);
    const limitValue = parseInt(limit, 10);
    const offset = (pageValue - 1) * limitValue;

    const filters = [];
    const values = [];
    let index = 1;

    if (leads_id) {
      filters.push(`leads_id = $${index}`);
      values.push(leads_id);
      index++;
    }

    if (recipient_id) {
      filters.push(`recipient_id = $${index}`);
      values.push(recipient_id);
      index++;
    }

    const whereClause =
      filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";

    const countQuery = `SELECT COUNT(*) FROM sms ${whereClause}`;
    const countResult = await client.query(countQuery, values);
    const totalRecords = parseInt(countResult.rows[0].count, 10);

    const selectQuery = `
      SELECT s.*, l.name as lead_name, u.name as recipient_name
      FROM sms s
      LEFT JOIN leads l ON s.leads_id = l.leads_id
      LEFT JOIN users u ON s.recipient_id = u.users_id
      ${whereClause}
      ORDER BY s.created_at DESC
      LIMIT $${index} OFFSET $${index + 1}
    `;

    const dataResult = await client.query(selectQuery, [
      ...values,
      limitValue,
      offset,
    ]);

    return successResponse(
      res,
      {
        sms: keysToCamelCase(dataResult.rows),
        pagination: {
          totalRecords,
          totalPages: Math.ceil(totalRecords / limitValue),
          currentPage: pageValue,
          limit: limitValue,
        },
      },
      "SMS fetched successfully.",
    );
  } catch (err) {
    console.error("Error fetching SMS:", err);
    return errorResponse(res, 500, "Internal Server Error");
  } finally {
    client.release();
  }
}

export async function getSmsById(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { sms_id } = req.params;

    const query = `
      SELECT s.*, l.name as lead_name, u.name as recipient_name
      FROM sms s
      LEFT JOIN leads l ON s.leads_id = l.leads_id
      LEFT JOIN users u ON s.recipient_id = u.users_id
      WHERE s.sms_id = $1
    `;

    const result = await client.query(query, [sms_id]);

    if (result.rowCount === 0) {
      return errorResponse(res, 404, "SMS not found.");
    }

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "SMS fetched successfully.",
    );
  } catch (err) {
    console.error("Error fetching SMS by ID:", err);
    return errorResponse(res, 500, "Internal Server Error");
  } finally {
    client.release();
  }
}

export async function updateSms(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { sms_id } = req.params;
    const { recipient_id, message } = req.body;

    const checkSms = await client.query(
      "SELECT sms_id FROM sms WHERE sms_id = $1",
      [sms_id],
    );

    if (checkSms.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "SMS not found.");
    }

    const fields = [];
    const values = [];
    let index = 1;

    if (recipient_id !== undefined) {
      fields.push(`recipient_id = $${index}`);
      values.push(recipient_id);
      index++;
    }

    if (message !== undefined) {
      fields.push(`message = $${index}`);
      values.push(message);
      index++;
    }

    if (fields.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "No fields to update.");
    }

    fields.push("updated_at = NOW()");

    const updateQuery = `
      UPDATE sms
      SET ${fields.join(", ")}
      WHERE sms_id = $${index}
      RETURNING *
    `;

    const result = await client.query(updateQuery, [...values, sms_id]);

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "SMS updated successfully.",
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error updating SMS:", err);
    return errorResponse(res, 500, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
}

export async function deleteSms(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { sms_id } = req.params;

    const result = await client.query(
      "DELETE FROM sms WHERE sms_id = $1 RETURNING sms_id",
      [sms_id],
    );

    if (result.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "SMS not found.");
    }

    await client.query("COMMIT");

    return successResponse(res, {}, "SMS deleted successfully.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error deleting SMS:", err);
    return errorResponse(res, 500, "Internal Server Error");
  } finally {
    client.release();
  }
}
