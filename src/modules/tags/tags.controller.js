import getPool from "../../config/database.js";
import { errorResponse, successResponse } from "../../helper/response.js";
import { keysToCamelCase } from "../../utils/common.js";

export async function getAllTags(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const query = "SELECT tag_id, name, created_at, updated_at FROM tags WHERE builder_id = $1;";
    const result = await client.query(query, [req.user.builder_id]);
    successResponse(
      res,
      keysToCamelCase(result.rows),
      "Tags fetched successfully.",
    );
  } catch (error) {
    errorResponse(
      res,
      error?.status || 400,
      error?.message || "Internal Server Error",
    );
  } finally {
    client.release();
  }
}
