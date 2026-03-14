const getPool = require("../../config/database");
const { errorResponse } = require("../../helper/response");
const { keysToCamelCase } = require("../../utils/common");
const { successResponse } = require("../../helper/response");

exports.getCountries = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const query = `SELECT * FROM country WHERE name = $1;`;
    const result = await client.query(query, ["australia"]);
    successResponse(res, keysToCamelCase(result.rows), "Countries fetched successfully.");
  } catch (error) {
    errorResponse(res, error?.status || 400, error?.message || "Internal Server Error");
  } finally {
    client.release();
  }
};
