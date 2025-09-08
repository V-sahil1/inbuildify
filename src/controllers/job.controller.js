const getPool = require("../config/database");
const { successResponse, errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.createJob = async (req, res) => {
  const { lead_id } = req.params;
  const builderId = req.user.builder_id;
  const { message, status } = req.body;

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const quotationResult = await client.query(
      `SELECT quotation_id FROM quotation WHERE lead_id = $1 AND builder_id = $2`,
      [lead_id, builderId]
    );

    if (quotationResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Quotation not found.");
    }

    const leadStatus = status === "WON" ? "JOB" : "CANCELLED";

    await client.query(
      `UPDATE leads SET status = $1, message = $2, decision = $3, updated_at = NOW() WHERE lead_id = $4 AND builder_id = $5`,
      [leadStatus, message, status, lead_id, builderId]
    );

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(quotationResult?.rows?.length > 0 ? quotationResult.rows[0] : {}),
      "Job created successfully."
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Create job error:", error);
    return errorResponse(res, 500, "Failed to create job.");
  } finally {
    client.release();
  }
};
