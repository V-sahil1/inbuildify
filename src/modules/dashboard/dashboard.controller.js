import getPool from "../../config/database";
import { successResponse, errorResponse } from "../../helper/response";
import { keysToCamelCase } from "../../utils/common";

export async function getDashboardData(req, res) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const builderId = req.user.builder_id;
    const query = `
    SELECT 
        (SELECT COUNT(*) FROM contractor WHERE builder_id = $1 AND is_deleted = false) AS contractor_count,
        COALESCE(
        (SELECT json_agg(c) 
        FROM (
            SELECT contractor_id, name, email, created_at
            FROM contractor 
            WHERE builder_id = $1 AND is_deleted = false
            ORDER BY created_at DESC
            LIMIT 3
        ) c
        ), '[]'
        ) AS contractor_data,

        (SELECT COUNT(*) FROM users WHERE builder_id = $1 AND is_deleted = false) AS users_count,
        COALESCE(
        (SELECT json_agg(u) 
        FROM (
            SELECT users_id, name, email, created_at
            FROM users 
            WHERE builder_id = $1 AND is_deleted = false AND is_verified = true
            ORDER BY created_at DESC
            LIMIT 3
        ) u
        ), '[]'
        ) AS users_data,

        (SELECT COUNT(*) FROM leads WHERE builder_id = $1 AND is_deleted = false) AS lead_count,
        COALESCE(
        (SELECT json_agg(l) 
        FROM (
            SELECT 
            ld.lead_id,
            lc.name,
            lc.email,
            ld.created_at
            FROM leads ld
              LEFT JOIN leads_contact lc 
                  ON ld.lead_contact_id = lc.leads_contact_id
              WHERE ld.builder_id = $1 
                AND ld.is_deleted = false
              ORDER BY ld.created_at DESC
              LIMIT 3
        ) l
        ), '[]'
        ) AS lead_data;
    `;
    const result = await client.query(query, [builderId]);
    const {
      contractor_count,
      contractor_data,
      users_count,
      users_data,
      lead_count,
      lead_data,
    } = result.rows[0];
    return successResponse(
      res,
      keysToCamelCase({
        contractor_count,
        contractor_data,
        users_count,
        users_data,
        lead_count,
        lead_data,
      }),
      "Dashboard data fetched successfully.",
    );
  } catch (error) {
    console.error("Error in getDashboardData:", error);
    return errorResponse(
      res,
      error?.statusCode || 400,
      error?.message || "Internal Server Error",
    );
  } finally {
    client.release();
  }
}
