import getPool from "../../config/database.js";
import { errorResponse, successResponse } from "../../helper/response.js";
import { keysToCamelCase } from "../../utils/common.js";

export async function getCountries(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const query = "SELECT * FROM country WHERE name = $1;";
    const result = await client.query(query, ["australia"]);
    successResponse(res, keysToCamelCase(result.rows), "Countries fetched successfully.");
  } catch (error) {
    errorResponse(res, error?.status || 400, error?.message || "Internal Server Error");
  } finally {
    client.release();
  }
}
