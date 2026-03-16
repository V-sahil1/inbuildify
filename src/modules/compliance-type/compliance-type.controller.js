import getPool from "../../config/database";
import { errorResponse, successResponse } from "../../helper/response";
import { keysToCamelCase } from "../../utils/common";

export async function getAllComplianceTypes(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const query = `
      SELECT *
      FROM compliance_type
      ORDER BY created_at DESC;
    `;

    const result = await client.query(query);

    return successResponse(
      res,
      keysToCamelCase(result.rows),
      "Compliance types fetched successfully.",
    );
  } catch (error) {
    console.error("Get All Compliance Types Error:", error);
    return errorResponse(res, 500, error.message || "Internal server error.");
  } finally {
    client.release();
  }
}
