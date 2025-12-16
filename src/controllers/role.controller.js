const { successResponse, errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");
const getPool = require("../config/database");

exports.createRole = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user.builder_id;
    const userId = req.user.user_id;
    const companyId = req.user?.company_id;
    const { name, type, description, is_active } = req.body;

    if (!companyId) {
      return errorResponse(res, 400, "Company ID not found.");
    }

    if (!name) {
      return errorResponse(res, 400, "Role name is required.");
    }

    await client.query("BEGIN");

    const duplicateCheck = await client.query(
      `SELECT 1 FROM role WHERE LOWER(name) = LOWER($1) AND builder_id = $2`,
      [name.trim(), builderId]
    );

    if (duplicateCheck.rowCount > 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "Role name already exists.");
    }

    const insertQuery = `
      INSERT INTO role (
        company_id,
        builder_id,
        name,
        type,
        description,
        is_active,
        created_by,
        updated_by
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *;
    `;

    const values = [
      companyId,
      builderId,
      name.trim(),
      type || null,
      description || null,
      is_active ?? true,
      userId || null,
      userId || null,
    ];

    const result = await client.query(insertQuery, values);
    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Role created successfully."
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error creating role:", error);
    return errorResponse(res, 500, error?.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.getAllRole = async (req, res) => {
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
      FROM role r
      WHERE r.builder_id = $1
      ORDER BY r.created_at DESC
      LIMIT $2 OFFSET $3;
    `;

    const dataResult = await client.query(dataQuery, [
      builderId,
      limitValue,
      offset,
    ]);

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM role
      WHERE builder_id = $1;
    `;
    const countResult = await client.query(countQuery, [builderId]);
    const totalRecords = parseInt(countResult.rows[0].total, 10);
    const totalPages = Math.ceil(totalRecords / limitValue);

    return successResponse(
      res,
      {
        role: keysToCamelCase(dataResult.rows),
        pagination: {
          currentPage: pageValue,
          totalPages,
          totalRecords,
          limit: limitValue,
        },
      },
      "Role fetched successfully."
    );
  } catch (error) {
    console.error("Error fetching role:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.deleteRole = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const builderId = req.user.builder_id;

    if (!id) {
      return errorResponse(res, 400, "Role ID is required.");
    }
    const existingRole = await client.query(
      `SELECT role_id FROM role WHERE role_id = $1 AND builder_id = $2`,
      [id, builderId]
    );

    if (existingRole.rowCount === 0) {
      return errorResponse(res, 404, "Role not found for this builder.");
    }

    await client.query(`DELETE FROM role WHERE role_id = $1`, [id]);

    return successResponse(res, null, "Role deleted successfully.");
  } catch (error) {
    console.error("Error deleting roke:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.updateRole = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user.builder_id;
    const userId = req.user.user_id;
    const companyId = req.user?.company_id;
    const { role_id } = req.params;
    const { name, type, description } = req.body;

    if (!role_id) {
      return errorResponse(res, 400, "role_id is required.");
    }

    await client.query("BEGIN");

    const checkRoleQuery = `
      SELECT * FROM role 
      WHERE role_id = $1 AND builder_id = $2 FOR UPDATE
    `;
    const checkRole = await client.query(checkRoleQuery, [role_id, builderId]);

    if (checkRole.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Role not found.");
    }

    const checkRoleActiveQuery = `
      SELECT * FROM role 
      WHERE role_id = $1 AND builder_id = $2 AND is_active = true FOR UPDATE
    `;
    const checkRoleActive = await client.query(checkRoleActiveQuery, [
      role_id,
      builderId,
    ]);

    if (checkRoleActive.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Inactive role.");
    }

    // const existing = checkRole.rows[0];

    // const currentIsActive = existing.is_active;
    // const isActiveInBody = is_active !== undefined;
    // const requestedIsActive = is_active;

    // const fieldsToCheck = ["name", "type", "description"];
    // const updatingOtherFields = fieldsToCheck.some(
    //   (field) => req.body[field] !== undefined
    // );

    // if (isActiveInBody && typeof requestedIsActive !== "boolean") {
    //   await client.query("ROLLBACK");
    //   return errorResponse(
    //     res,
    //     400,
    //     "The 'is_active' field must be a boolean (true or false)."
    //   );
    // }

    // if (
    //   currentIsActive === true &&
    //   isActiveInBody &&
    //   requestedIsActive === false
    // ) {
    //   if (updatingOtherFields) {
    //     await client.query("ROLLBACK");
    //     return errorResponse(
    //       res,
    //       403,
    //       "To deactivate an active role, 'is_active' must be the only field provided in the request."
    //     );
    //   }
    // }

    // if (currentIsActive === false) {
    //   if (isActiveInBody && requestedIsActive === true) {
    //     if (updatingOtherFields) {
    //       await client.query("ROLLBACK");
    //       return errorResponse(
    //         res,
    //         403,
    //         "To activate an inactive role, 'is_active' must be the only field provided in the request."
    //       );
    //     }
    //   }

    //   const performingActivation = isActiveInBody && requestedIsActive === true;

    //   if (updatingOtherFields && !performingActivation) {
    //     await client.query("ROLLBACK");
    //     return errorResponse(
    //       res,
    //       403,
    //       "Cannot update non-'is_active' fields when the role is currently Inactive. Only 'is_active' can be changed (to true/Active)."
    //     );
    //   }

    //   if (isActiveInBody && requestedIsActive === false) {
    //     await client.query("ROLLBACK");
    //     return errorResponse(
    //       res,
    //       403,
    //       "Role is already Inactive. 'is_active' can only be updated to true (Active) from this state."
    //     );
    //   }
    // }

    if (name !== undefined && name.trim() !== "") {
      const duplicateCheck = await client.query(
        `SELECT 1 FROM role 
         WHERE LOWER(name) = LOWER($1) 
         AND builder_id = $2 
         AND role_id != $3`,
        [name.trim(), builderId, role_id]
      );

      if (duplicateCheck.rowCount > 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Role name already exists.");
      }
    }

    const fields = [];
    const values = [];
    let index = 1;

    if (name !== undefined) {
      fields.push(`name = $${index}`);
      values.push(name ? name.trim() : null);
      index++;
    }

    if (type !== undefined) {
      fields.push(`type = $${index}`);
      values.push(type || null);
      index++;
    }

    if (description !== undefined) {
      fields.push(`description = $${index}`);
      values.push(description || null);
      index++;
    }

    if (companyId !== undefined) {
      fields.push(`company_id = $${index}`);
      values.push(companyId);
      index++;
    }

    fields.push(`updated_by = $${index}`);
    values.push(userId);
    index++;

    fields.push(`updated_at = NOW()`);

    if (fields.length === 2 && !name && !type && !description) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "At least one field must be provided for update (name, type, description)."
      );
    }

    const updateQuery = `
      UPDATE role
      SET ${fields.join(", ")}
      WHERE role_id = $${index} AND builder_id = $${index + 1}
      RETURNING *;
    `;

    values.push(role_id, builderId);

    const result = await client.query(updateQuery, values);
    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Role updated successfully."
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error updating role:", error);
    return errorResponse(res, 500, error?.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.updateRoleIsActive = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const userId = req.user?.user_id;
    const { role_id } = req.params;
    const { is_active } = req.body;

    if (!role_id) {
      return errorResponse(res, 400, "Role id is required");
    }

    if (typeof is_active !== "boolean") {
      return errorResponse(
        res,
        400,
        "is_active must be boolean (true or false)"
      );
    }

    const existing = await client.query(
      `
      SELECT role_id
      FROM role
      WHERE role_id = $1
        AND builder_id = $2
      `,
      [role_id, builderId]
    );

    if (existing.rowCount === 0) {
      return errorResponse(res, 404, "role not found for this builder");
    }

    const updateQuery = `
      UPDATE role
      SET
        is_active = $1,
        updated_by = $2,
        updated_at = NOW()
      WHERE role_id = $3
      RETURNING *;
    `;

    const updated = await client.query(updateQuery, [
      is_active,
      userId,
      role_id,
    ]);

    return successResponse(
      res,
      keysToCamelCase(updated.rows[0]),
      "role status updated successfully."
    );
  } catch (error) {
    console.error("Error updating role is_active:", error);
    return errorResponse(res, 500, error?.message || "Internal Server Error");
  } finally {
    client.release();
  }
};
