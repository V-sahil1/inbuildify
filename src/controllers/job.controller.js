const getPool = require("../config/database");
const { successResponse, errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.createJob = async (req, res) => {
  const { lead_id } = req.params;
  const builderId = req.user.builder_id;
  const { message, status, quotation_version_id } = req.body;

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const quotationResult = await client.query(
      `SELECT quotation_id FROM quotation WHERE lead_id = $1 AND builder_id = $2 AND is_deleted = false`,
      [lead_id, builderId]
    );

    if (quotationResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Quotation not found.");
    }

    const leadStatus = status === "WON" ? "JOB" : "CANCELLED";

    const checkLeadExists = await client.query(
      `SELECT 1 FROM leads WHERE lead_id = $1 AND builder_id = $2 AND decision is not null AND quotation_version_id is not null`,
      [lead_id, builderId]
    );
    if (checkLeadExists.rows.length > 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        404,
        "Lead already converted to job or lost status."
      );
    }

    if (status === "WON") {
      if (!quotation_version_id) {
        throw new Error("quotation_version_id is required when status is WON");
      }

      const quotationVersionExists = await client.query(
        `
        SELECT quotation_id, version_number FROM quotation_versions WHERE quotation_version_id = $1 AND quotation_id = ANY($2)
      `,
        [
          quotation_version_id,
          quotationResult.rows.map((row) => row.quotation_id),
        ]
      );

      if (quotationVersionExists.rows.length === 0) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          404,
          "Quotation version not found for that quotation."
        );
      }

      const { quotation_id, version_number } = quotationVersionExists.rows[0];

      const latestVersionRes = await client.query(
        `
        SELECT MAX(version_number) AS max_version FROM quotation_versions WHERE quotation_id = $1
      `,
        [quotation_id]
      );
      const latestVersion = latestVersionRes.rows[0].max_version;

      if (version_number !== latestVersion) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          `Only the latest quotation version (v${latestVersion}) can be used when status is WON`
        );
      }

      await client.query(
        `
        UPDATE leads SET status = $1, message = $2, decision = $3, quotation_version_id = $4, updated_at = NOW() WHERE lead_id = $5 AND builder_id = $6
      `,
        [leadStatus, message, status, quotation_version_id, lead_id, builderId]
      );
    } else {
      await client.query(
        `
        UPDATE leads SET status = $1, message = $2, decision = $3, updated_at = NOW() WHERE lead_id = $4 AND builder_id = $5
      `,
        [leadStatus, message, status, lead_id, builderId]
      );
    }

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(
        quotationResult?.rows?.length > 0 ? quotationResult.rows[0] : {}
      ),
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
