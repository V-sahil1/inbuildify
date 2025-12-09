const getPool = require("../config/database");
const { successResponse, errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.createUserGroup = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.user_id;
    const { name, is_active = true } = req.body;

    if (!name || !name.trim()) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "Group name is required.");
    }

    const userCheckQuery = `
      SELECT users_id 
      FROM users 
      WHERE users_id = $1 AND  is_deleted = false;
    `;
    const userCheckResult = await client.query(userCheckQuery, [userId]);
    if (userCheckResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 403, "User is not valid or inactive.");
    }

    const checkDuplicateQuery = `
      SELECT user_group_id 
      FROM user_group 
      WHERE LOWER(name) = LOWER($1) 
        AND builder_id = $2
      LIMIT 1;
    `;
    const duplicate = await client.query(checkDuplicateQuery, [
      name.trim(),
      builderId,
    ]);
    if (duplicate.rows.length > 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        409,
        "A user group with this name already exists for this builder."
      );
    }

    const insertQuery = `
      INSERT INTO user_group (
        company_id,
        builder_id,
        name,
        is_active,
        created_by_id,
        updated_by_id
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;

    const insertResult = await client.query(insertQuery, [
      companyId,
      builderId,
      name.trim(),
      is_active,
      userId,
      userId,
    ]);

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(insertResult.rows[0]),
      "User group created successfully."
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error creating user group:", error);

    if (error.code === "23505") {
      return errorResponse(res, 409, "User group name must be unique.");
    }

    return errorResponse(res, 500, "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.getAllUserGroups = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const { is_active, page = 1, limit = 25 } = req.query;

    const limitValue = parseInt(limit, 10);
    const pageValue = parseInt(page, 10);
    const offset = (pageValue - 1) * limitValue;

    let baseQuery = `
      SELECT 
        user_group_id,
        company_id,
        builder_id,
        name,
        is_active,
        created_by_id,
        updated_by_id,
        created_at,
        updated_at,
        created_by_id,
        updated_by_id
      FROM user_group 
      WHERE builder_id = $1
    `;

    const params = [builderId];
    let paramIndex = 2;

    if (is_active !== undefined && is_active !== "") {
      baseQuery += ` AND is_active = $${paramIndex}`;
      params.push(is_active === "true");
      paramIndex++;
    }

    let countQuery = `
      SELECT COUNT(*) AS total
      FROM user_group
      WHERE builder_id = $1
    `;
    const countParams = [builderId];
    let countIndex = 2;

    if (is_active !== undefined && is_active !== "") {
      countQuery += ` AND is_active = $${countIndex}`;
      countParams.push(is_active === "true");
      countIndex++;
    }

    baseQuery += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${
      paramIndex + 1
    }`;
    params.push(limitValue, offset);

    const [result, countResult] = await Promise.all([
      client.query(baseQuery, params),
      client.query(countQuery, countParams),
    ]);

    const total = parseInt(countResult.rows[0].total, 10);

    return successResponse(
      res,
      {
        userGroups: keysToCamelCase(result.rows),
        pagination: {
          totalRecords: total,
          currentPage: pageValue,
          totalPages: Math.ceil(total / limitValue),
          limit: limitValue,
        },
      },
      "User groups fetched successfully."
    );
  } catch (error) {
    console.error("Error fetching user groups:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.updateUserGroup = async (req, res) => {
  const { id } = req.params;
  const builderId = req.user.builder_id;
  const userId = req.user.user_id;

  const { name, is_active } = req.body;

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const checkGroup = await client.query(
      `SELECT * FROM user_group WHERE user_group_id = $1 AND builder_id = $2 FOR UPDATE`,
      [id, builderId]
    );

    if (checkGroup.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        404,
        "User group not found or not authorized to update."
      );
    }

    const old = checkGroup.rows[0];
    const currentStatus = old.is_active;
    const statusInBody = req.body.is_active !== undefined;
    const requestedStatus = is_active;

    const fieldsToCheck = ["name"];

    const updatingOtherFields = fieldsToCheck.some(
      (field) => req.body[field] !== undefined
    );

    if (currentStatus === true && statusInBody && requestedStatus === false) {
      if (updatingOtherFields) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          403,
          "To deactivate an active user group, 'is_active' must be the only field provided in the request."
        );
      }
    }

    if (currentStatus === false) {
      if (statusInBody && requestedStatus === true) {
        if (updatingOtherFields) {
          await client.query("ROLLBACK");
          return errorResponse(
            res,
            403,
            "To activate an inactive user group, 'is_active' must be the only field provided in the request."
          );
        }
      }

      const performingActivation = statusInBody && requestedStatus === true;

      if (updatingOtherFields && !performingActivation) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          403,
          "Cannot update non-'is_active' fields when the user group is currently Inactive. Only 'is_active' can be changed (to true/Active)."
        );
      }

      if (statusInBody && requestedStatus === false) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          403,
          "User group is already Inactive. 'is_active' can only be updated to true (Active) from this state."
        );
      }
    }
    const updateFields = [];
    const updateValues = [];
    let i = 1;

    const push = (column, value) => {
      updateFields.push(`${column} = $${i++}`);
      updateValues.push(value);
    };

    if (name) push("name", name);

    if (statusInBody) {
      if (typeof is_active !== "boolean") {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "The 'is_active' field must be a boolean (true or false)."
        );
      }
      push("is_active", is_active);
    }

    push("updated_by_id", userId);
    updateFields.push("updated_at = NOW()");

    if (updateFields.length <= 2) {
      const hasActualUpdate = name || statusInBody;
      if (!hasActualUpdate) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "At least one field (name or is_active) is required to update."
        );
      }
    }

    updateValues.push(id);
    updateValues.push(builderId);

    const updateQuery = `
      UPDATE user_group
      SET ${updateFields.join(", ")}
      WHERE user_group_id = $${i++} AND builder_id = $${i}
      RETURNING *;
    `;

    const result = await client.query(updateQuery, updateValues);

    if (result.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "Failed to update user group.");
    }

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "User group updated successfully."
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Update user group error:", error);
    return errorResponse(
      res,
      500,
      "Failed to update user group due to an internal error."
    );
  } finally {
    client.release();
  }
};
