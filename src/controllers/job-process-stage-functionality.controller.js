const getPool = require("../config/database");
const { errorResponse, successResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.getJobProcessStageFunctionalities = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const getQuery = `
      SELECT *
      FROM job_process_stage_functionality
      ORDER BY name
    `;

    const result = await client.query(getQuery);

    return successResponse(
      res,
      keysToCamelCase(result.rows),
      "Job process stage functionalities fetched successfully."
    );
  } catch (error) {
    console.error("Error fetching job process stage functionalities:", error);
    return errorResponse(res, 500, "Internal server error.", error.message);
  } finally {
    client.release();
  }
};