const { successResponse, errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");
const getPool = require("../config/database");

exports.createRolePermission = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.user_id;

    if (!builderId || !companyId) {
      return errorResponse(res, 401, "Unauthorized.");
    }

    const {
      role_id,
      module_name,
      can_create,
      can_read,
      can_update,
      can_delete,
      is_active,
    } = req.body || {};

    await client.query("BEGIN");

    const roleCheck = await client.query(
      `SELECT role_id FROM role WHERE role_id = $1 AND builder_id = $2`,
      [role_id, builderId]
    );

    if (roleCheck.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        404,
        "Invalid role_id: No role found for this builder."
      );
    }

    const roleActiveCheck = await client.query(
      `SELECT role_id FROM role WHERE role_id = $1 AND builder_id = $2 AND is_active = true`,
      [role_id, builderId]
    );

    if (roleActiveCheck.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Inactive role.");
    }

    const duplicateCheck = await client.query(
      `SELECT role_permission_id
       FROM role_permission
       WHERE role_id = $1
       AND builder_id = $2
       AND company_id = $3
       AND LOWER(module_name) = LOWER($4)`,
      [role_id, builderId, companyId, module_name.trim()]
    );

    if (duplicateCheck.rowCount > 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "Permission already exists for this role and module."
      );
    }

    const insertQuery = `
      INSERT INTO role_permission (
        role_id,
        company_id,
        builder_id,
        module_name,
        can_create,
        can_read,
        can_update,
        can_delete,
        is_active,
        created_by,
        updated_by
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING *;
    `;

    const values = [
      role_id,
      companyId,
      builderId,
      module_name.trim(),
      can_create ?? false,
      can_read ?? false,
      can_update ?? false,
      can_delete ?? false,
      is_active ?? true,
      userId,
      userId,
    ];

    const result = await client.query(insertQuery, values);

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Role permission created successfully."
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Create Role Permission Error:", error);
    return errorResponse(res, 500, "Internal Server Error.");
  } finally {
    client.release();
  }
};

exports.getAllRolePermission = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user.builder_id;
    const { page = 1, limit = 25 } = req.query;

    const limitValue = parseInt(limit, 10);
    const pageValue = parseInt(page, 10);
    const offset = (pageValue - 1) * limitValue;

    const dataQuery = `
      SELECT 
       *
      FROM role_permission rp
      WHERE rp.builder_id = $1
      ORDER BY rp.created_at DESC
      LIMIT $2 OFFSET $3;
    `;

    const dataResult = await client.query(dataQuery, [
      builderId,
      limitValue,
      offset,
    ]);

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM role_permission
      WHERE builder_id = $1;
    `;
    const countResult = await client.query(countQuery, [builderId]);
    const totalRecords = parseInt(countResult.rows[0].total, 10);
    const totalPages = Math.ceil(totalRecords / limitValue);

    return successResponse(
      res,
      {
        rolePermission: keysToCamelCase(dataResult.rows),
        pagination: {
          currentPage: pageValue,
          totalPages,
          totalRecords,
          limit: limitValue,
        },
      },
      "Role permission fetched successfully."
    );
  } catch (error) {
    console.error("Error fetching role permission:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.deleteRolePermission = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const builderId = req.user.builder_id;

    if (!id) {
      return errorResponse(res, 400, "Role permission iD is required.");
    }
    const existingRolePermission = await client.query(
      `SELECT role_permission_id FROM role_permission WHERE role_permission_id = $1 AND builder_id = $2`,
      [id, builderId]
    );

    if (existingRolePermission.rowCount === 0) {
      return errorResponse(
        res,
        404,
        "Role permission not found for this builder."
      );
    }

    await client.query(
      `DELETE FROM role_permission WHERE role_permission_id = $1`,
      [id]
    );

    return successResponse(res, null, "Role permission deleted successfully.");
  } catch (error) {
    console.error("Error deleting role permission:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.updateRolePermission = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user.builder_id;
    const userId = req.user.user_id;
    const companyId = req.user?.company_id;
    const { role_permission_id } = req.params;

    const {
      role_id,
      module_name,
      can_create,
      can_read,
      can_update,
      can_delete,
      is_active,
    } = req.body;

    if (!role_permission_id) {
      return errorResponse(res, 400, "role_permission_id is required.");
    }

    await client.query("BEGIN");

    const existRes = await client.query(
      `SELECT role_id, is_active 
       FROM role_permission 
       WHERE role_permission_id = $1 AND builder_id = $2 FOR UPDATE`,
      [role_permission_id, builderId]
    );

    if (existRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Role permission not found.");
    }

    const existing = existRes.rows[0];
    const oldRoleId = existing.role_id;

    let finalRoleId = oldRoleId;

    if (role_id) {
      const roleCheck = await client.query(
        `SELECT role_id 
         FROM role 
         WHERE role_id = $1 
         AND builder_id = $2 
         AND company_id = $3`,
        [role_id, builderId, companyId]
      );

      if (roleCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "Invalid role_id: role does not exist or not owned by this builder."
        );
      }

      const roleActiveCheck = await client.query(
        `SELECT role_id 
         FROM role 
         WHERE role_id = $1 
         AND builder_id = $2 
         AND company_id = $3 AND is_active = true`,
        [role_id, builderId, companyId]
      );

      if (roleActiveCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Inactive role.");
      }

      finalRoleId = role_id;
    }

    // IS_ACTIVE LOGIC → NOT MODIFIED (AS PER YOUR REQUEST)
    const currentIsActive = existing.is_active;
    const isActiveInBody = is_active !== undefined;
    const requestedIsActive = is_active;

    const fieldsToCheck = [
      "module_name",
      "can_create",
      "can_read",
      "can_update",
      "can_delete",
      "role_id", // role_id is part of other-field update check
    ];

    const updatingOtherFields = fieldsToCheck.some(
      (field) => req.body[field] !== undefined
    );

    // same is_active logic (unchanged)
    if (isActiveInBody && typeof requestedIsActive !== "boolean") {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "'is_active' must be a boolean.");
    }

    if (
      currentIsActive === true &&
      isActiveInBody &&
      requestedIsActive === false
    ) {
      if (updatingOtherFields) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          403,
          "To deactivate, only 'is_active' must be provided."
        );
      }
    }

    if (currentIsActive === false) {
      if (isActiveInBody && requestedIsActive === true) {
        if (updatingOtherFields) {
          await client.query("ROLLBACK");
          return errorResponse(
            res,
            403,
            "To activate, only 'is_active' must be provided."
          );
        }
      }

      const performingActivation = isActiveInBody && requestedIsActive === true;

      if (updatingOtherFields && !performingActivation) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          403,
          "Cannot update other fields when inactive."
        );
      }

      if (isActiveInBody && requestedIsActive === false) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          403,
          "Already inactive. You can only activate it."
        );
      }
    }

    const duplicateCheck = await client.query(
      `SELECT role_permission_id
       FROM role_permission
       WHERE role_id = $1
       AND builder_id = $2
       AND company_id = $3
       AND LOWER(module_name) = LOWER($4)`,
      [finalRoleId, builderId, companyId, module_name]
    );

    if (duplicateCheck.rowCount > 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "Permission already exists for this role and module."
      );
    }

    // Build update fields
    const fields = [];
    const values = [];
    let idx = 1;

    const addField = (field, value) => {
      if (value !== undefined) {
        fields.push(`${field} = $${idx}`);
        values.push(value);
        idx++;
      }
    };

    addField("role_id", role_id);
    addField("module_name", module_name ? module_name.trim() : module_name);
    addField("can_create", can_create);
    addField("can_read", can_read);
    addField("can_update", can_update);
    addField("can_delete", can_delete);
    addField("is_active", is_active);

    if (fields.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "At least one field is required.");
    }

    // Duplicate module check (updated to use finalRoleId)
    if (module_name !== undefined && module_name.trim() !== "") {
      const duplicateCheck = await client.query(
        `SELECT 1 FROM role_permission 
         WHERE LOWER(module_name) = LOWER($1)
         AND role_id = $2 
         AND builder_id = $3 
         AND company_id = $4
         AND role_permission_id != $5`,
        [
          module_name.trim(),
          finalRoleId,
          builderId,
          companyId,
          role_permission_id,
        ]
      );

      if (duplicateCheck.rowCount > 0) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "Module name already exists for this role."
        );
      }
    }

    fields.push(`updated_by = $${idx}`);
    values.push(userId);
    idx++;

    fields.push(`updated_at = NOW()`);

    const updateQuery = `
      UPDATE role_permission
      SET ${fields.join(", ")}
      WHERE role_permission_id = $${idx} 
      AND builder_id = $${idx + 1}
      AND company_id = $${idx + 2}
      RETURNING *;
    `;

    values.push(role_permission_id, builderId, companyId);

    const result = await client.query(updateQuery, values);

    if (result.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "No changes or invalid access.");
    }

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Role permission updated successfully."
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error updating role permission:", error);
    return errorResponse(res, 500, error.message);
  } finally {
    client.release();
  }
};
