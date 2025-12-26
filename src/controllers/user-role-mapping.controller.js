const getPool = require("../config/database");
const { successResponse, errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.createUserRoleMapping = async (req, res) => {
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
      WHERE builder_id = $1
        AND role_id = $2
      `,
      [builderId, role_id]
    );

    if (roleResult.rowCount === 0) {
      return errorResponse(res, 404, "No role found for this builder.");
    }

    const roleActiveResult = await client.query(
      `
      SELECT role_id
      FROM role
      WHERE builder_id = $1
        AND role_id = $2
        AND is_active = true
      `,
      [builderId, role_id]
    );

    if (roleActiveResult.rowCount === 0) {
      return errorResponse(res, 404, "Role is inactive.");
    }

    if (role_type_id) {
      const roleTypeResult = await client.query(
        `
        SELECT role_type_id
        FROM role_type
        WHERE role_type_id = $1
          AND role_id = $2
          AND (
            (company_id IS NULL AND builder_id IS NULL)
            OR (company_id = $3 AND $3 IS NOT NULL)
            OR (builder_id = $4 AND $4 IS NOT NULL)
          )
        LIMIT 1
        `,
        [role_type_id, role_id, companyId, builderId]
      );

      if (roleTypeResult.rowCount === 0) {
        return errorResponse(
          res,
          400,
          "Invalid role_type_id or role_type not accessible for this role."
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
        [user_id]
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
      LIMIT 1
      `,
      [role_id, user_id, role_type_id]
    );

    if (duplicateResult.rowCount > 0) {
      return errorResponse(res, 409, "This role mapping already exists.");
    }

    const insertResult = await client.query(
      `
      INSERT INTO user_role_mapping (
        user_id,
        role_id,
        role_type_id,
        assigned_by
      )
      VALUES ($1, $2, $3, $4)
      RETURNING *;
      `,
      [user_id, role_id, role_type_id, assigned_by]
    );

    return successResponse(
      res,
      keysToCamelCase(insertResult.rows[0]),
      "Role mapping created successfully."
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
};

exports.getAllUserRoleMapping = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId || !companyId) {
      return errorResponse(res, 401, "Unauthorized.");
    }

    let { page = 1, limit = 25 } = req.query;
    page = parseInt(page);
    limit = parseInt(limit);

    const offset = (page - 1) * limit;

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM user_role_mapping urm
      JOIN role r ON urm.role_id = r.role_id
      WHERE r.builder_id = $1
    `;

    const countResult = await client.query(countQuery, [builderId]);
    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);

    const dataQuery = `
      SELECT 
        urm.user_role_mapping_id,
        urm.user_id,
        urm.role_id,
        urm.role_type_id,
        urm.assigned_by,
        urm.assigned_at
      FROM user_role_mapping urm
      JOIN role r ON urm.role_id = r.role_id
      JOIN users u ON u.users_id = urm.user_id
      LEFT JOIN users ab ON ab.users_id = urm.assigned_by
      WHERE r.builder_id = $1
      ORDER BY urm.assigned_at DESC
      LIMIT $2 OFFSET $3;
    `;

    const dataResult = await client.query(dataQuery, [
      builderId,
      limit,
      offset,
    ]);

    return successResponse(
      res,
      {
        userRoleMapping: keysToCamelCase(dataResult.rows),
        records: total,
        curruntPage: page,
        limit,
        totalPages,
      },
      "User role mapping fetched successfully."
    );
  } catch (error) {
    console.error("Get User Role Mapping Error:", error);
    return errorResponse(res, 500, "Internal Server Error.");
  } finally {
    client.release();
  }
};

exports.deleteUserRoleMapping = async (req, res) => {
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
      WHERE urm.user_role_mapping_id = $1
      AND r.builder_id = $2;
    `;

    const findResult = await client.query(findQuery, [
      user_role_mapping_id,
      builderId,
    ]);

    if (findResult.rowCount === 0) {
      return errorResponse(
        res,
        404,
        "Record not found or you are not allowed to delete this record."
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

    return successResponse(
      res,
      keysToCamelCase(deleteResult.rows[0]),
      "User role mapping deleted successfully."
    );
  } catch (error) {
    console.error("Delete User Role Mapping Error:", error);
    return errorResponse(res, 500, "Internal Server Error.");
  } finally {
    client.release();
  }
};

exports.updateUserRoleMapping = async (req, res) => {
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
      WHERE user_role_mapping_id = $1;
      `,
      [user_role_mapping_id]
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
        WHERE builder_id = $1
          AND role_id = $2;
        `,
        [builderId, finalRoleId]
      );

      if (roleResult.rowCount === 0) {
        return errorResponse(res, 404, "No role found for this builder.");
      }

      const roleActiveResult = await client.query(
        `
        SELECT role_id
        FROM role
        WHERE builder_id = $1
          AND role_id = $2
          AND is_active = true;
        `,
        [builderId, finalRoleId]
      );

      if (roleActiveResult.rowCount === 0) {
        return errorResponse(res, 404, "Role is inactive.");
      }
    }

    if (finalRoleTypeId) {
      const roleTypeResult = await client.query(
        `
        SELECT role_type_id
        FROM role_type
        WHERE role_type_id = $1
          AND role_id = $2
          AND (
            (company_id IS NULL AND builder_id IS NULL)
            OR (company_id = $3 AND $3 IS NOT NULL)
            OR (builder_id = $4 AND $4 IS NOT NULL)
          )
        LIMIT 1;
        `,
        [finalRoleTypeId, finalRoleId, companyId, builderId]
      );

      if (roleTypeResult.rowCount === 0) {
        return errorResponse(
          res,
          400,
          "Invalid role_type_id or role_type not accessible for this role."
        );
      }
    }

    if (user_id !== undefined && finalUserId !== null) {
      const userResult = await client.query(
        `
        SELECT users_id
        FROM users
        WHERE users_id = $1 AND is_deleted = false;
        `,
        [finalUserId]
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
        AND user_role_mapping_id <> $4
      LIMIT 1;
      `,
      [finalRoleId, finalUserId, finalRoleTypeId, user_role_mapping_id]
    );

    if (duplicateResult.rowCount > 0) {
      return errorResponse(res, 409, "This role mapping already exists.");
    }

    const fields = [];
    const values = [];
    let idx = 1;

    fields.push(`user_id = $${idx++}`);
    values.push(finalUserId);

    fields.push(`role_id = $${idx++}`);
    values.push(finalRoleId);

    fields.push(`role_type_id = $${idx++}`);
    values.push(finalRoleTypeId);

    fields.push(`assigned_by = $${idx++}`);
    values.push(finalAssignedBy);

    const updateQuery = `
      UPDATE user_role_mapping
      SET ${fields.join(", ")}
      WHERE user_role_mapping_id = $${idx}
      RETURNING *;
    `;

    values.push(user_role_mapping_id);

    const updateResult = await client.query(updateQuery, values);

    return successResponse(
      res,
      keysToCamelCase(updateResult.rows[0]),
      "User role mapping updated successfully."
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
};
