import getPool from "../../config/database.js";
import { successResponse, errorResponse } from "../../helper/response.js";
import { keysToCamelCase } from "../../utils/common.js";

export async function createOpportunity(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { lead_id } = req.params;

    await client.query("BEGIN");

    const checkQuery = "SELECT * FROM leads WHERE lead_id = $1 AND status = 'NEW' AND builder_id = $2;";

    const checkResult = await client.query(checkQuery, [lead_id, req.user.builder_id]);

    if (checkResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Lead not found or already converted to opportunity.");
    }

    const updateQuery = "UPDATE leads SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE lead_id = $2 AND builder_id = $3 RETURNING *;";

    const updateResult = await client.query(updateQuery, ["IN_PROGRESS", lead_id, req.user.builder_id]);

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase({
        lead_id: updateResult.rows[0].lead_id,
        status: updateResult.rows[0].status,
        updated_at: updateResult.rows[0].updated_at,
      }),
      "Lead converted to opportunity successfully",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    return errorResponse(res, error?.status || 400, error?.message || "Internal server error");
  } finally {
    client.release();
  }
}

export async function getAllOpportunities(req, res) {
  const pool = getPool();
  try {
    const { lead_id } = req.query;
    const builderId = req.user.builder_id;

    let query = `
      SELECT o.*, l.name as lead_name, l.reference_number
      FROM opportunity o
      JOIN leads l ON o.leads_id = l.leads_id
      WHERE l.builder_id = $1
    `;
    const params = [builderId];

    if (lead_id) {
      query += " AND o.leads_id = $2";
      params.push(lead_id);
    }

    query += " ORDER BY o.created_at DESC";

    const result = await pool.query(query, params);

    return successResponse(
      res,
      keysToCamelCase(result.rows),
      "Opportunities fetched successfully",
    );
  } catch (error) {
    console.error("Get all opportunities error:", error);
    return errorResponse(res, 500, "Internal server error");
  }
}
