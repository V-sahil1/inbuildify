import getPool from "../../config/database";
import { successResponse, errorResponse } from "../../helper/response";
import { keysToCamelCase } from "../../utils/common";

export async function getSalesProcessStageFunctionalities(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const query = `
      SELECT 
        functionality_id,
        name
      FROM sales_process_stage_functionality
      ORDER BY name ASC
    `;

    const result = await client.query(query);

    return successResponse(
      res,
      keysToCamelCase(result.rows),
      "Sales process stage functionalities retrieved successfully.",
    );

  } catch (error) {
    console.error("Error fetching sales process stage functionalities:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
}
