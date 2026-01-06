const getPool = require("../config/database");
const { successResponse, errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.getSalesProcessStageFunctionalities = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const query = `
      SELECT 
        functionality_id,
        name
      FROM sales_process_stage_functionality
      ORDER BY name ASC
    `;

    const result = await client.query(query);

    return successResponse(
      res,
      result.rows,
      "Sales process stage functionalities retrieved successfully."
    );

  } catch (error) {
    console.error("Error fetching sales process stage functionalities:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
};