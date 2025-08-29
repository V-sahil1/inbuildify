const getPool = require("../config/database");
const { successResponse, errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.getDashboardData = async (req, res) => {
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

        (SELECT COUNT(*) FROM customer WHERE builder_id = $1 AND is_deleted = false) AS customer_count,
        COALESCE(
        (SELECT json_agg(cu) 
        FROM (
            SELECT customer_id, name, email, created_at
            FROM customer 
            WHERE builder_id = $1 AND is_deleted = false
            ORDER BY created_at DESC
            LIMIT 3
        ) cu
        ), '[]'
        ) AS customer_data,

        (SELECT COUNT(*) FROM users WHERE builder_id = $1 AND is_deleted = false) AS users_count,
        COALESCE(
        (SELECT json_agg(u) 
        FROM (
            SELECT users_id, name, email, created_at
            FROM users 
            WHERE builder_id = $1 AND is_deleted = false
            ORDER BY created_at DESC
            LIMIT 3
        ) u
        ), '[]'
        ) AS users_data,

        (SELECT COUNT(*) FROM leads) AS lead_count,
        COALESCE(
        (SELECT json_agg(l) 
        FROM (
            SELECT lead_id, email, created_at
            FROM leads 
            ORDER BY created_at DESC
            LIMIT 3
        ) l
        ), '[]'
        ) AS lead_data;
    `;
    const result = await client.query(query, [builderId]);
    const {
      contractor_count,
      contractor_data,
      customer_count,
      customer_data,
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
        customer_count,
        customer_data,
        users_count,
        users_data,
        lead_count,
        lead_data,
      }),
      "Dashboard data fetched successfully."
    );
  } catch (error) {
    console.error("Error in getDashboardData:", error);
    return errorResponse(
      res,
      error?.statusCode || 400,
      error?.message || "Internal Server Error"
    );
  } finally {
    client.release();
  }
};
