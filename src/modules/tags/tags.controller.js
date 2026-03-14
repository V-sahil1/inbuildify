const getPool = require("../../config/database");
const { errorResponse } = require("../../helper/response");
const { keysToCamelCase } = require("../../utils/common");
const { successResponse } = require("../../helper/response");

exports.getAllTags = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const query = `SELECT tag_id, name, created_at, updated_at FROM tags WHERE builder_id = $1;`;
    const result = await client.query(query, [req.user.builder_id]);
    successResponse(
      res,
      keysToCamelCase(result.rows),
      "Tags fetched successfully."
    );
  } catch (error) {
    errorResponse(
      res,
      error?.status || 400,
      error?.message || "Internal Server Error"
    );
  } finally {
    client.release();
  }
};
