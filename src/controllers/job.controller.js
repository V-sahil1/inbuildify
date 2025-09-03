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

    const quotationId = quotationResult.rows[0].quotation_id;

    const jobResult = await client.query(
      `SELECT job_id FROM job WHERE quotation_id = $1 AND builder_id = $2`,
      [quotationId, builderId]
    );

    if (jobResult.rows.length > 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 409, "Job already exists.");
    }

    let result;
    if (status === "WON") {
      const insertJobQuery = `
        INSERT INTO job (builder_id, quotation_id)
        VALUES ($1, $2)
        RETURNING job_id, builder_id, quotation_id, created_at, updated_at;
      `;
      result = await client.query(insertJobQuery, [builderId, quotationId]);
    }

    const leadStatus = status === "WON" ? "JOB" : "CANCELLED";

    await client.query(
      `UPDATE leads SET status = $1, message = $2, decision = $3, updated_at = NOW() WHERE lead_id = $4 AND builder_id = $5`,
      [leadStatus, message, status, lead_id, builderId]
    );

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result?.rows?.length > 0 ? result.rows[0] : {}),
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

exports.getJobById = async (req, res) => {
  const { job_id } = req.params;
  const pool = getPool();
  const client = await pool.connect();

  try {
    const query = `
      SELECT j.job_id, j.builder_id, j.quotation_id, j.created_at, j.updated_at,
             b.name AS builder_name,
             q.items AS quotation_items
      FROM job j
      JOIN builder b ON j.builder_id = b.builder_id
      JOIN quotation q ON j.quotation_id = q.quotation_id
      WHERE j.job_id = $1;
    `;

    const result = await client.query(query, [job_id]);

    if (result.rowCount === 0) {
      return errorResponse(res, 404, "Job not found.");
    }

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Job fetched successfully."
    );
  } catch (error) {
    console.error("Get job by ID error:", error);
    return errorResponse(res, 500, "Failed to fetch job.");
  } finally {
    client.release();
  }
};
