const { successResponse, errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");
const getPool = require("../config/database");

exports.createRoleType = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { company_id, builder_id } = req.user;
    const { type_name, role_id } = req.body;

    if (!type_name || !role_id) {
      return errorResponse(res, 400, "type_name and role_id are required");
    }

    const roleCheckQuery = `
      SELECT role_id
      FROM role
      WHERE role_id = $1
        AND is_active = TRUE
      LIMIT 1
    `;
    const roleCheckResult = await client.query(roleCheckQuery, [role_id]);

    if (roleCheckResult.rowCount === 0) {
      return errorResponse(res, 400, "Invalid or inactive role_id");
    }

    const duplicateCheckQuery = `
      SELECT role_type_id
      FROM role_type
      WHERE type_name = $1
        AND role_id = $2
        AND (
          (company_id = $3 AND $3 IS NOT NULL)
          OR
          (builder_id = $4 AND $4 IS NOT NULL)
        )
      LIMIT 1
    `;
    const duplicateResult = await client.query(duplicateCheckQuery, [
      type_name,
      role_id,
      company_id,
      builder_id,
    ]);

    if (duplicateResult.rowCount > 0) {
      return errorResponse(res, 409, "Role type already exists for this scope");
    }

    const insertQuery = `
      INSERT INTO role_type (
        company_id,
        builder_id,
        type_name,
        role_id
      )
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    const insertResult = await client.query(insertQuery, [
      company_id,
      builder_id,
      type_name,
      role_id,
    ]);

    return successResponse(
      res,
      keysToCamelCase(insertResult.rows[0]),
      "Role type created successfully"
    );
  } catch (error) {
    console.error("Error creating role type:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.getRoleTypes = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { company_id, builder_id } = req.user;
    const { page = 1, limit = 25 } = req.query;

    const limitValue = parseInt(limit, 10);
    const pageValue = parseInt(page, 10);
    const offset = (pageValue - 1) * limitValue;

    const dataQuery = `
      SELECT
        rt.role_type_id,
        rt.type_name,
        rt.role_id,
        rt.company_id,
        rt.builder_id,
        rt.created_at,
        rt.updated_at
      FROM role_type rt
      WHERE
        (
          (rt.company_id IS NULL AND rt.builder_id IS NULL) -- GLOBAL
          OR
          (rt.company_id = $1 AND $1 IS NOT NULL)
          OR
          (rt.builder_id = $2 AND $2 IS NOT NULL)
        )
      ORDER BY rt.type_name
      LIMIT $3 OFFSET $4;
    `;

    const dataResult = await client.query(dataQuery, [
      company_id,
      builder_id,
      limitValue,
      offset,
    ]);

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM role_type rt
      WHERE
        (
          (rt.company_id IS NULL AND rt.builder_id IS NULL)
          OR
          (rt.company_id = $1 AND $1 IS NOT NULL)
          OR
          (rt.builder_id = $2 AND $2 IS NOT NULL)
        );
    `;

    const countResult = await client.query(countQuery, [
      company_id,
      builder_id,
    ]);

    const totalRecords = parseInt(countResult.rows[0].total, 10);
    const totalPages = Math.ceil(totalRecords / limitValue);

    return successResponse(
      res,
      {
        roleTypes: keysToCamelCase(dataResult.rows),
        pagination: {
          currentPage: pageValue,
          totalPages,
          totalRecords,
          limit: limitValue,
        },
      },
      "Role types fetched successfully"
    );
  } catch (error) {
    console.error("Error fetching role types:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
};
