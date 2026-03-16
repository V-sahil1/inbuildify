import getPool from "../../config/database";
import { successResponse, errorResponse } from "../../helper/response";
import { keysToCamelCase } from "../../utils/common";

export async function getAllTimezones(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const dataQuery = `
      SELECT
        *
      FROM timezones
      ORDER BY utc_offset_minutes, display_name;
    `;

    const dataResult = await client.query(dataQuery);

    return successResponse(
      res,
      {
        timezones: keysToCamelCase(dataResult.rows),
      },
      "Timezones fetched successfully.",
    );
  } catch (error) {
    console.error("Error fetching timezones:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
}
