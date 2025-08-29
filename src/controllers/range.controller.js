const getPool = require("../config/database");
const { errorResponse, successResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.getAllRanges = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const query = `
      SELECT * FROM range ORDER BY range;
    `;

    const result = await client.query(query);

    return successResponse(
      res,
      keysToCamelCase(result.rows),
      "Ranges fetched successfully."
    );
  } catch (error) {
    console.error(error);
    return errorResponse(res, 500, error?.message || "Internal Server Error");
  } finally {
    client.release();
  }
};
