import getPool from "../../config/database.js";
import { errorResponse, successResponse } from "../../helper/response.js";
import { keysToCamelCase } from "../../utils/common.js";

export async function getConditions(req, res) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const query = "SELECT * FROM conditions ORDER BY name ASC";
    const result = await client.query(query);
    return successResponse(
      res,
      keysToCamelCase(result.rows),
      "Conditions fetched successfully.",
    );
  } catch (err) {
    console.error("Error fetching conditions:", err);
    return errorResponse(res, err?.statusCode || 400, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
}
