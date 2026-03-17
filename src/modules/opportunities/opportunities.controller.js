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
