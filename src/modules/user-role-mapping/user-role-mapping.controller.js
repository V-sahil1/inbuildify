import getPool from "../../config/database.js";
import { successResponse, errorResponse } from "../../helper/response.js";
import { keysToCamelCase } from "../../utils/common.js";

export async function createUserRoleMapping(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId || !companyId) {
      return errorResponse(res, 401, "Unauthorized.");
    }

    const {
      role_type_id = null,
      user_id = null,
      role_id,
      assigned_by = null,
    } = req.body || {};

    if (!role_id) {
      return errorResponse(res, 400, "role_id is required.");
    }

    const roleResult = await client.query(
      `
      SELECT role_id
      FROM role
      WHERE role_id = $1
      `,
      [role_id],
    );

    if (roleResult.rowCount === 0) {
      return errorResponse(res, 404, "No role found.");
    }

    if (role_type_id) {
      const roleTypeResult = await client.query(
        `
        SELECT role_type_id
        FROM role_type
        WHERE role_type_id = $1
          AND role_id = $2
        LIMIT 1
        `,
        [role_type_id, role_id],
      );

      if (roleTypeResult.rowCount === 0) {
        return errorResponse(
          res,
          400,
          "Invalid role_type_id or role_type not linked to this role.",
        );
      }
    }

    if (user_id) {
      const userResult = await client.query(
        `
        SELECT users_id
        FROM users
        WHERE users_id = $1 AND is_deleted = false
        `,
        [user_id],
      );

      if (userResult.rowCount === 0) {
        return errorResponse(res, 404, "No user found.");
      }
    }

    const duplicateResult = await client.query(
      `
      SELECT user_role_mapping_id
      FROM user_role_mapping
      WHERE role_id = $1
        AND (
          (user_id = $2)
          OR (user_id IS NULL AND $2 IS NULL)
        )
        AND (
          (role_type_id = $3)
          OR (role_type_id IS NULL AND $3 IS NULL)
        )
        AND builder_id = $4
      LIMIT 1
      `,
      [role_id, user_id, role_type_id, builderId],
    );

    if (duplicateResult.rowCount > 0) {
      return errorResponse(res, 409, "This role mapping already exists.");
    }

    const insertResult = await client.query(
      `
      INSERT INTO user_role_mapping (
        company_id,
        builder_id,
        user_id,
        role_id,
        role_type_id,
        assigned_by
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING user_role_mapping_id;
      `,
      [companyId, builderId, user_id, role_id, role_type_id, assigned_by],
    );

    const mappingId = insertResult.rows[0].user_role_mapping_id;

    const responseQuery = `
      SELECT 
        urm.user_role_mapping_id,

        urm.user_id,
        u.name AS user_name,

        urm.role_id,
        r.name AS role_name,

        urm.role_type_id,
        rt.type_name AS role_type_name,

        urm.assigned_by,
        ab.name AS assigned_by_name,

        urm.assigned_at
      FROM user_role_mapping urm
      LEFT JOIN users u ON u.users_id = urm.user_id
      LEFT JOIN role r ON r.role_id = urm.role_id
      LEFT JOIN role_type rt ON rt.role_type_id = urm.role_type_id
      LEFT JOIN users ab ON ab.users_id = urm.assigned_by
      WHERE urm.user_role_mapping_id = $1
    `;

    const responseResult = await client.query(responseQuery, [mappingId]);
    const row = responseResult.rows[0];

    const formattedResponse = {
      userRoleMappingId: row.user_role_mapping_id,

      user: row.user_id ? { id: row.user_id, name: row.user_name } : null,

      role: row.role_id ? { id: row.role_id, name: row.role_name } : null,

      roleType: row.role_type_id
        ? { id: row.role_type_id, name: row.role_type_name }
        : null,

      assignedBy: row.assigned_by
        ? { id: row.assigned_by, name: row.assigned_by_name }
        : null,

      assignedAt: row.assigned_at,
    };

    return successResponse(
      res,
      formattedResponse,
      "Role mapping created successfully.",
    );
  } catch (error) {
    console.error("Create User Role Mapping Error:", error);

    if (error.code === "23505") {
      return errorResponse(res, 409, "This role mapping already exists.");
    }

    return errorResponse(res, 500, "Internal Server Error.");
  } finally {
    client.release();
  }
}

export async function getAllUserRoleMapping(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId || !companyId) {
      return errorResponse(res, 401, "Unauthorized.");
    }

    let { page = 1, limit = 25, assigned_by } = req.query;
    page = parseInt(page);
    limit = parseInt(limit);

    const offset = (page - 1) * limit;

    const whereConditions = ["urm.builder_id = $1"];
    const values = [builderId];
    let idx = 2;

    if (assigned_by) {
      whereConditions.push(`urm.assigned_by = $${idx++}`);
      values.push(assigned_by);
    }

    const whereClause =
      whereConditions.length > 0
        ? `WHERE ${whereConditions.join(" AND ")}`
        : "";

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM user_role_mapping urm
      LEFT JOIN role r ON urm.role_id = r.role_id
      LEFT JOIN users u ON u.users_id = urm.user_id
      LEFT JOIN role_type rt ON rt.role_type_id = urm.role_type_id
      LEFT JOIN users ab ON ab.users_id = urm.assigned_by
      ${whereClause}
    `;

    const countResult = await client.query(countQuery, values);
    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);

    const dataQuery = `
      SELECT 
        urm.user_role_mapping_id,

        urm.user_id,
        u.name AS user_name,

        urm.role_id,
        r.name AS role_name,

        urm.role_type_id,
        rt.type_name AS role_type_name,

        urm.assigned_by,
        ab.name AS assigned_by_name,

        urm.assigned_at
      FROM user_role_mapping urm
      LEFT JOIN role r ON urm.role_id = r.role_id
      LEFT JOIN users u ON u.users_id = urm.user_id
      LEFT JOIN role_type rt ON rt.role_type_id = urm.role_type_id
      LEFT JOIN users ab ON ab.users_id = urm.assigned_by
      ${whereClause}
      ORDER BY urm.assigned_at DESC
      LIMIT $${idx} OFFSET $${idx + 1};
    `;

    const dataResult = await client.query(dataQuery, [
      ...values,
      limit,
      offset,
    ]);

    const formattedResult = dataResult.rows.map((row) => ({
      userRoleMappingId: row.user_role_mapping_id,

      user: row.user_id ? { id: row.user_id, name: row.user_name } : null,

      role: row.role_id ? { id: row.role_id, name: row.role_name } : null,

      roleType: row.role_type_id
        ? { id: row.role_type_id, name: row.role_type_name }
        : null,

      assignedBy: row.assigned_by
        ? { id: row.assigned_by, name: row.assigned_by_name }
        : null,

      assignedAt: row.assigned_at,
    }));

    return successResponse(
      res,
      {
        userRoleMapping: formattedResult,
        records: total,
        currentPage: page,
        limit,
        totalPages,
      },
      "User role mapping fetched successfully.",
    );
  } catch (error) {
    console.error("Get User Role Mapping Error:", error);
    return errorResponse(res, 500, "Internal Server Error.");
  } finally {
    client.release();
  }
}

export async function deleteUserRoleMapping(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const { user_role_mapping_id } = req.params;

    if (!builderId || !companyId) {
      return errorResponse(res, 401, "Unauthorized.");
    }

    const findQuery = `
      SELECT urm.user_role_mapping_id
      FROM user_role_mapping urm
      JOIN role r ON urm.role_id = r.role_id
      WHERE urm.user_role_mapping_id = $1 AND urm.builder_id = $2
    `;

    const findResult = await client.query(findQuery, [
      user_role_mapping_id,
      builderId,
    ]);

    if (findResult.rowCount === 0) {
      return errorResponse(
        res,
        404,
        "Record not found or you are not allowed to delete this record.",
      );
    }

    const deleteQuery = `
      DELETE FROM user_role_mapping
      WHERE user_role_mapping_id = $1
      RETURNING *;
    `;

    const deleteResult = await client.query(deleteQuery, [
      user_role_mapping_id,
    ]);

    return successResponse(res, {}, "User role mapping deleted successfully.");
  } catch (error) {
    console.error("Delete User Role Mapping Error:", error);
    return errorResponse(res, 500, "Internal Server Error.");
  } finally {
    client.release();
  }
}

export async function updateUserRoleMapping(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { user_role_mapping_id } = req.params;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId || !companyId) {
      return errorResponse(res, 401, "Unauthorized.");
    }

    const {
      user_id = undefined,
      role_id = undefined,
      role_type_id = undefined,
      assigned_by = undefined,
    } = req.body || {};

    const existingResult = await client.query(
      `
      SELECT *
      FROM user_role_mapping
      WHERE user_role_mapping_id = $1
        AND builder_id = $2;
      `,
      [user_role_mapping_id, builderId],
    );

    if (existingResult.rowCount === 0) {
      return errorResponse(res, 404, "User role mapping not found.");
    }

    const existing = existingResult.rows[0];

    const finalUserId = user_id !== undefined ? user_id : existing.user_id;

    const finalRoleId = role_id !== undefined ? role_id : existing.role_id;

    const finalRoleTypeId =
      role_type_id !== undefined ? role_type_id : existing.role_type_id;

    const finalAssignedBy =
      assigned_by !== undefined ? assigned_by : existing.assigned_by;

    if (role_id !== undefined) {
      const roleResult = await client.query(
        `
        SELECT role_id
        FROM role
        WHERE role_id = $1;
        `,
        [finalRoleId],
      );

      if (roleResult.rowCount === 0) {
        return errorResponse(res, 404, "No role found.");
      }
    }

    if (finalRoleTypeId) {
      const roleTypeResult = await client.query(
        `
        SELECT role_type_id
        FROM role_type
        WHERE role_type_id = $1
          AND role_id = $2
        LIMIT 1;
        `,
        [finalRoleTypeId, finalRoleId],
      );

      if (roleTypeResult.rowCount === 0) {
        return errorResponse(
          res,
          400,
          "Invalid role_type_id or role_type not accessible for this role.",
        );
      }
    }

    if (user_id !== undefined && finalUserId !== null) {
      const userResult = await client.query(
        `
        SELECT users_id
        FROM users
        WHERE users_id = $1
          AND is_deleted = false;
        `,
        [finalUserId],
      );

      if (userResult.rowCount === 0) {
        return errorResponse(res, 404, "No user found.");
      }
    }

    const duplicateResult = await client.query(
      `
      SELECT user_role_mapping_id
      FROM user_role_mapping
      WHERE role_id = $1
        AND (
          (user_id = $2)
          OR (user_id IS NULL AND $2 IS NULL)
        )
        AND (
          (role_type_id = $3)
          OR (role_type_id IS NULL AND $3 IS NULL)
        )
        AND builder_id = $4
        AND user_role_mapping_id <> $5
      LIMIT 1;
      `,
      [
        finalRoleId,
        finalUserId,
        finalRoleTypeId,
        builderId,
        user_role_mapping_id,
      ],
    );

    if (duplicateResult.rowCount > 0) {
      return errorResponse(res, 409, "This role mapping already exists.");
    }

    const updateResult = await client.query(
      `
      UPDATE user_role_mapping
      SET
        user_id = $1,
        role_id = $2,
        role_type_id = $3,
        assigned_by = $4,
        company_id = $5
      WHERE user_role_mapping_id = $6
      RETURNING user_role_mapping_id;
      `,
      [
        finalUserId,
        finalRoleId,
        finalRoleTypeId,
        finalAssignedBy,
        companyId,
        user_role_mapping_id,
      ],
    );

    const updatedMappingId = updateResult.rows[0].user_role_mapping_id;

    const responseQuery = `
      SELECT 
        urm.user_role_mapping_id,

        urm.user_id,
        u.name AS user_name,

        urm.role_id,
        r.name AS role_name,

        urm.role_type_id,
        rt.type_name AS role_type_name,

        urm.assigned_by,
        ab.name AS assigned_by_name,

        urm.assigned_at
      FROM user_role_mapping urm
      LEFT JOIN users u ON u.users_id = urm.user_id
      LEFT JOIN role r ON r.role_id = urm.role_id
      LEFT JOIN role_type rt ON rt.role_type_id = urm.role_type_id
      LEFT JOIN users ab ON ab.users_id = urm.assigned_by
      WHERE urm.user_role_mapping_id = $1
    `;

    const responseResult = await client.query(responseQuery, [
      updatedMappingId,
    ]);

    const row = responseResult.rows[0];

    const formattedResponse = {
      userRoleMappingId: row.user_role_mapping_id,

      user: row.user_id ? { id: row.user_id, name: row.user_name } : null,

      role: row.role_id ? { id: row.role_id, name: row.role_name } : null,

      roleType: row.role_type_id
        ? { id: row.role_type_id, name: row.role_type_name }
        : null,

      assignedBy: row.assigned_by
        ? { id: row.assigned_by, name: row.assigned_by_name }
        : null,

      assignedAt: row.assigned_at,
    };

    return successResponse(
      res,
      formattedResponse,
      "User role mapping updated successfully.",
    );
  } catch (error) {
    console.error("Update User Role Mapping Error:", error);

    if (error.code === "23505") {
      return errorResponse(res, 409, "This role mapping already exists.");
    }

    return errorResponse(res, 500, "Internal Server Error.");
  } finally {
    client.release();
  }
}
