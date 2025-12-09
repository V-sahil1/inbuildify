const getPool = require("../config/database");
const { successResponse, errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.createUserRoleMapping = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const currentUserId = req.user?.user_id;

    if (!builderId || !companyId) {
      return errorResponse(res, 401, "Unauthorized.");
    }

    const { user_id, role_id, assigned_by } = req.body || {};

    if (!user_id || !role_id) {
      return errorResponse(res, 400, "user_id and role_id are required.");
    }

    const roleResult = await client.query(
      `SELECT role_id FROM role WHERE builder_id = $1 AND role_id = $2`,
      [builderId, role_id]
    );

    if (roleResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "No role found for this builder.");
    }

    const roleActiveResult = await client.query(
      `SELECT role_id FROM role WHERE builder_id = $1 AND role_id = $2 AND is_active = true`,
      [builderId, role_id]
    );

    if (roleActiveResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "role is inactive.");
    }

    const userResult = await client.query(
      `SELECT users_id FROM users WHERE users_id = $1`,
      [user_id]
    );

    if (userResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "No user found.");
    }

    const assignedByFinal = assigned_by || currentUserId;

    const duplicateQuery = `
      SELECT user_role_mapping_id
      FROM user_role_mapping
      WHERE user_id = $1 AND role_id = $2;
    `;

    const duplicateResult = await client.query(duplicateQuery, [
      user_id,
      role_id,
    ]);

    if (duplicateResult.rowCount > 0) {
      return errorResponse(
        res,
        409,
        "This role is already assigned to the selected user."
      );
    }

    const insertQuery = `
      INSERT INTO user_role_mapping (
        user_id,
        role_id,
        assigned_by
      )
      VALUES ($1, $2, $3)
      RETURNING *;
    `;

    const insertValues = [user_id, role_id, assignedByFinal];

    const result = await client.query(insertQuery, insertValues);

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Role assigned to user successfully."
    );
  } catch (error) {
    console.error("Create User Role Mapping Error:", error);

    if (error.code === "23505") {
      return errorResponse(
        res,
        409,
        "This role is already assigned to the selected user."
      );
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
    const currentUserId = req.user?.user_id;

    if (!builderId) {
      return errorResponse(res, 401, "Unauthorized.");
    }

    const { user_id, role_id, assigned_by } = req.body || {};

    const existingQuery = `
      SELECT *
      FROM user_role_mapping
      WHERE user_role_mapping_id = $1;
    `;
    const existingResult = await client.query(existingQuery, [
      user_role_mapping_id,
    ]);

    if (existingResult.rowCount === 0) {
      return errorResponse(res, 404, "User role mapping not found.");
    }

    const existing = existingResult.rows[0];

    const finalUserId = user_id ?? existing.user_id;
    const finalRoleId = role_id ?? existing.role_id;
    const finalAssignedBy =
      assigned_by ?? existing.assigned_by ?? currentUserId;

    if (role_id !== undefined) {
      const roleResult = await client.query(
        `SELECT role_id FROM role WHERE builder_id = $1 AND role_id = $2`,
        [builderId, finalRoleId]
      );

      if (roleResult.rowCount === 0) {
        return errorResponse(res, 404, "No role found for this builder.");
      }
    }

    if (role_id !== undefined) {
      const roleResult = await client.query(
        `SELECT role_id FROM role WHERE builder_id = $1 AND role_id = $2 AND is_active = true`,
        [builderId, finalRoleId]
      );

      if (roleResult.rowCount === 0) {
        return errorResponse(res, 404, "role is inactive.");
      }
    }

    if (user_id !== undefined) {
      const userResult = await client.query(
        `SELECT users_id FROM users WHERE users_id = $1`,
        [finalUserId]
      );

      if (userResult.rowCount === 0) {
        return errorResponse(res, 404, "No user found.");
      }
    }

    const duplicateQuery = `
      SELECT user_role_mapping_id
      FROM user_role_mapping
      WHERE user_id = $1 
        AND role_id = $2
        AND user_role_mapping_id <> $3;
    `;

    const duplicateResult = await client.query(duplicateQuery, [
      finalUserId,
      finalRoleId,
      user_role_mapping_id,
    ]);

    if (duplicateResult.rowCount > 0) {
      return errorResponse(
        res,
        409,
        "This role is already assigned to the selected user."
      );
    }

    const fields = [];
    const values = [];
    let idx = 1;

    fields.push(`user_id = $${idx++}`);
    values.push(finalUserId);

    fields.push(`role_id = $${idx++}`);
    values.push(finalRoleId);

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
      return errorResponse(
        res,
        409,
        "This role is already assigned to the selected user."
      );
    }

    return errorResponse(res, 500, "Internal Server Error.");
  } finally {
    client.release();
  }
};
