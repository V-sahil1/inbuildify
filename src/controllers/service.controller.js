const getPool = require("../config/database");
const { errorResponse, successResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.getServices = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const query = `SELECT * FROM service WHERE (builder_id IS NULL OR builder_id = $1);`;
    const result = await client.query(query, [req.user.builder_id]);
    const services = result.rows;
    return successResponse(res, keysToCamelCase(services), "Services retrieved successfully");
  } catch (error) {
    return errorResponse(res, error.message);
  } finally {
    client.release();
  }
};