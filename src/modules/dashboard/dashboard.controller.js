import getPool from "../../config/database.js";
import { successResponse, errorResponse } from "../../helper/response.js";
import { keysToCamelCase } from "../../utils/common.js";
import { deleteCacheByPrefix, getCache, setCache } from "../../service/redisCache.service.js";

const WIDGET_CACHE_TTL_SECONDS = 3600;

export async function getDashboardData(req, res) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const builderId = req.user.builder_id;
    const cacheKey = `dashboard:data:builder:${builderId}`;
    const cachedPayload = await getCache(cacheKey);

    if (cachedPayload) {
      return successResponse(res, cachedPayload, "Dashboard data fetched successfully.");
    }

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
            ld.leads_id,
            ld.name,
            ld.email,
            ld.created_at
            FROM leads ld
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
    const payload = keysToCamelCase({
      contractor_count,
      contractor_data,
      users_count,
      users_data,
      lead_count,
      lead_data,
    });

    await setCache(cacheKey, payload, WIDGET_CACHE_TTL_SECONDS);

    return successResponse(res, payload, "Dashboard data fetched successfully.");
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

export async function refreshWidgetsCache(req, res) {
  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId && !companyId) {
      return errorResponse(res, 401, "Unauthorized: Builder or company ID missing");
    }

    await Promise.all([
      deleteCacheByPrefix(`dashboard:data:builder:${builderId || "na"}`),
      deleteCacheByPrefix(`job:list:builder:${builderId || "na"}:company:${companyId || "na"}:`),
    ]);

    return successResponse(res, {}, "Widget cache refreshed successfully.");
  } catch (error) {
    console.error("Error in refreshWidgetsCache:", error);
    return errorResponse(
      res,
      error?.statusCode || 400,
      error?.message || "Internal Server Error",
    );
  }
}
