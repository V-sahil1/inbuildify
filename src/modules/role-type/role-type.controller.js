const { successResponse, errorResponse } = require("../../helper/response");
const { keysToCamelCase } = require("../../utils/common");
const getPool = require("../../config/database");

exports.createRoleType = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const userId = req.user?.user_id;
    const { type_name, role_id } = req.body;

    if (!type_name || !role_id) {
      return errorResponse(res, 400, "type_name and role_id are required");
    }

    const roleCheckQuery = `
      SELECT role_id
      FROM role
      WHERE role_id = $1
      LIMIT 1
    `;
    const roleCheckResult = await client.query(roleCheckQuery, [role_id]);

    if (roleCheckResult.rowCount === 0) {
      return errorResponse(res, 400, "Invalid role_id");
    }

    const duplicateCheckQuery = `
      SELECT role_type_id
      FROM role_type
      WHERE LOWER(type_name) = LOWER($1)
        AND role_id = $2
      LIMIT 1
    `;
    const duplicateResult = await client.query(duplicateCheckQuery, [
      type_name.trim(),
      role_id,
    ]);

    if (duplicateResult.rowCount > 0) {
      return errorResponse(res, 409, "Role type already exists for this role");
    }

    const insertQuery = `
      INSERT INTO role_type (
        role_id,
        type_name,
        created_by,
        updated_by
      )
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;

    const insertResult = await client.query(insertQuery, [
      role_id,
      type_name.trim(),
      userId || null,
      userId || null,
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
    const { role, page = 1, limit = 25 } = req.query;

    if (!role) {
      return errorResponse(res, 400, "role (role_id) is required");
    }

    const limitValue = parseInt(limit, 10);
    const pageValue = parseInt(page, 10);
    const offset = (pageValue - 1) * limitValue;

    if (role) {
      const roleCheck = await client.query(
        `SELECT role_id FROM role WHERE role_id = $1 LIMIT 1`,
        [role]
      );

      if (roleCheck.rowCount === 0) {
        return errorResponse(res, 400, "Invalid role_id");
      }
    }

    const dataQuery = `
      SELECT
        role_type_id,
        role_id,
        type_name,
        created_by,
        updated_by,
        created_at,
        updated_at
      FROM role_type
      WHERE role_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const dataResult = await client.query(dataQuery, [
      role,
      limitValue,
      offset,
    ]);

    const countQuery = `
      SELECT COUNT(*)::int AS total
      FROM role_type
      WHERE role_id = $1
    `;
    const countResult = await client.query(countQuery, [role]);

    return successResponse(
      res,
      {
        roleType: keysToCamelCase(dataResult.rows),
        pagination: {
          total: countResult.rows[0].total,
          page: pageValue,
          limit: limitValue,
          totalPages: Math.ceil(countResult.rows[0].total / limitValue),
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

exports.getAllRoleTypes = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { page = 1, limit = 25 } = req.query;

    const limitValue = parseInt(limit, 10);
    const pageValue = parseInt(page, 10);
    const offset = (pageValue - 1) * limitValue;

    const dataQuery = `
      SELECT
       *
      FROM role_type
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `;

    const dataResult = await client.query(dataQuery, [limitValue, offset]);

    const countQuery = `
      SELECT COUNT(*)::int AS total
      FROM role_type
    `;

    const countResult = await client.query(countQuery);

    return successResponse(
      res,
      {
        data: keysToCamelCase(dataResult.rows),
        pagination: {
          total: countResult.rows[0].total,
          page: pageValue,
          limit: limitValue,
          totalPages: Math.ceil(countResult.rows[0].total / limitValue),
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
