const getPool = require("../config/database");
const { errorResponse, successResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.getConditions = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();
  try {
    let query = `SELECT * FROM conditions ORDER BY name ASC`;
    const result = await client.query(query);
    return successResponse(
      res,
      keysToCamelCase(result.rows),
      "Conditions fetched successfully."
    );
  } catch (err) {
    console.error("Error fetching conditions:", err);
    return errorResponse(res, err?.statusCode || 400, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
};
