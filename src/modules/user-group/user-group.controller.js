import getPool from "../../config/database.js";
import { successResponse, errorResponse } from "../../helper/response.js";
import { keysToCamelCase } from "../../utils/common.js";
import db from "../../config/database/models/postgre-models/index.js";
import { QueryTypes } from "sequelize";

export async function createUserGroup(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.user_id;

    const { name, is_active = true, users_id = [] } = req.body;

    if (!Array.isArray(users_id)) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "users_id must be an array.");
    }

    const userCheckQuery = `
      SELECT users_id
      FROM users
      WHERE users_id = $1 AND is_deleted = false AND is_verified = true;
    `;
    const userCheckResult = await client.query(userCheckQuery, [userId]);

    if (userCheckResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 403, "User is not valid or not verify.");
    }

    if (users_id.length > 0) {
      const usersValidationQuery = `
        SELECT users_id
        FROM users
        WHERE users_id = ANY($1::uuid[])
          AND is_verified = true;
      `;

      const usersValidationResult = await client.query(usersValidationQuery, [
        users_id,
      ]);

      if (usersValidationResult.rowCount !== users_id.length) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "One or more users are inavlid or not verify.",
        );
      }
    }

    const dupCheckQuery = `
  SELECT 1
  FROM user_group
  WHERE builder_id = $1
    AND LOWER(name) = LOWER($2)
  LIMIT 1;
`;
    const dupCheckResult = await client.query(dupCheckQuery, [
      builderId,
      name.trim(),
    ]);

    if (dupCheckResult.rowCount > 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "A user group with this name already exists for this builder.",
      );
    }

    const insertQuery = `
      INSERT INTO user_group (
        company_id,
        builder_id,
        name,
        users_id,
        is_active,
        created_by_id,
        updated_by_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING company_id,
        builder_id,
        name,
        users_id,
        is_active,
        created_by_id,
        updated_by_id,
        created_at,
        updated_at;
    `;

    const insertResult = await client.query(insertQuery, [
      companyId || null,
      builderId || null,
      name.trim(),
      users_id,
      is_active,
      userId,
      userId,
    ]);

    let usersDetails = [];
    if (users_id.length > 0) {
      const usersQuery = `
        SELECT users_id, name
        FROM users
        WHERE users_id = ANY($1::uuid[])
          AND is_deleted = false
          AND is_verified = true
      `;
      const usersResult = await client.query(usersQuery, [users_id]);
      usersDetails = usersResult.rows.map((user) => ({
        id: user.users_id,
        name: user.name,
      }));
    }

    await client.query("COMMIT");

    const response = {
      ...keysToCamelCase({
        company_id: insertResult.rows[0].company_id,
        builder_id: insertResult.rows[0].builder_id,
        name: insertResult.rows[0].name,
        is_active: insertResult.rows[0].is_active,
        created_by_id: insertResult.rows[0].created_by_id,
        updated_by_id: insertResult.rows[0].updated_by_id,
        created_at: insertResult.rows[0].created_at,
        updated_at: insertResult.rows[0].updated_at,
      }),
      users: usersDetails,
    };

    return successResponse(res, response, "User group created successfully.");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error creating user group:", error);
    return errorResponse(res, 500, "Internal Server Error");
  } finally {
    client.release();
  }
}

export async function getAllUserGroups(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const { is_active, search = "", page = 1, limit = 25 } = req.query;

    const limitValue = parseInt(limit, 10);
    const pageValue = parseInt(page, 10);
    const offset = (pageValue - 1) * limitValue;

    let baseQuery = `
      SELECT 
        user_group_id,
        company_id,
        builder_id,
        name,
        users_id,
        is_active,
        created_by_id,
        updated_by_id,
        created_at,
        updated_at
      FROM user_group 
      WHERE builder_id = $1
    `;

    const params = [builderId];
    let paramIndex = 2;

    const parsedIsActive =
      is_active === undefined || is_active === ""
        ? undefined
        : typeof is_active === "boolean"
          ? is_active
          : is_active === "true";

    if (parsedIsActive !== undefined) {
      baseQuery += ` AND is_active = $${paramIndex}`;
      params.push(parsedIsActive);
      paramIndex++;
    }

    if (search) {
      baseQuery += ` AND name ILIKE $${paramIndex}`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    let countQuery = `
      SELECT COUNT(*) AS total
      FROM user_group
      WHERE builder_id = $1
    `;
    const countParams = [builderId];
    let countIndex = 2;

    if (parsedIsActive !== undefined) {
      countQuery += ` AND is_active = $${countIndex}`;
      countParams.push(parsedIsActive);
      countIndex++;
    }

    if (search) {
      countQuery += ` AND name ILIKE $${countIndex}`;
      countParams.push(`%${search}%`);
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

    const userGroupsWithUsers = await Promise.all(
      result.rows.map(async (group) => {
        let usersDetails = [];
        if (group.users_id && group.users_id.length > 0) {
          const usersQuery = `
            SELECT users_id, name
            FROM users
            WHERE users_id = ANY($1::uuid[])
              AND is_deleted = false
              AND is_verified = true
          `;
          const usersResult = await client.query(usersQuery, [group.users_id]);
          usersDetails = usersResult.rows.map((user) => ({
            id: user.users_id,
            name: user.name,
          }));
        }

        return {
          ...keysToCamelCase({
            user_group_id: group.user_group_id,
            company_id: group.company_id,
            builder_id: group.builder_id,
            name: group.name,
            is_active: group.is_active,
            created_by_id: group.created_by_id,
            updated_by_id: group.updated_by_id,
            created_at: group.created_at,
            updated_at: group.updated_at,
          }),
          users: usersDetails,
        };
      }),
    );

    return successResponse(
      res,
      {
        userGroups: userGroupsWithUsers,
        pagination: {
          totalRecords: total,
          currentPage: pageValue,
          totalPages: Math.ceil(total / limitValue),
          limit: limitValue,
        },
      },
      "User groups fetched successfully.",
    );
  } catch (error) {
    console.error("Error fetching user groups:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
}

export async function updateUserGroup(req, res) {
  const { id } = req.params;
  const builderId = req.user.builder_id;
  const userId = req.user.user_id;

  const { name, is_active, users_id } = req.body;

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const checkGroup = await client.query(
      `SELECT * 
       FROM user_group 
       WHERE user_group_id = $1 
         AND builder_id = $2 
       FOR UPDATE`,
      [id, builderId],
    );

    if (checkGroup.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        404,
        "User group not found or not authorized to update.",
      );
    }

    const old = checkGroup.rows[0];
    const currentStatus = old.is_active;
    const statusInBody = req.body.is_active !== undefined;
    const requestedStatus = is_active;

    const fieldsToCheck = ["name", "users_id"];

    const updatingOtherFields = fieldsToCheck.some(
      (field) => req.body[field] !== undefined,
    );

    if (currentStatus === true && statusInBody && requestedStatus === false) {
      if (updatingOtherFields) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          403,
          "To deactivate an active user group, only 'is_active' is allowed.",
        );
      }
    }

    if (currentStatus === false) {
      const performingActivation = statusInBody && requestedStatus === true;

      if (performingActivation && updatingOtherFields) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          403,
          "To activate an inactive user group, only 'is_active' is allowed.",
        );
      }

      if (updatingOtherFields && !performingActivation) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          403,
          "Cannot update fields when the user group is inactive.",
        );
      }

      if (statusInBody && requestedStatus === false) {
        await client.query("ROLLBACK");
        return errorResponse(res, 403, "User group is already inactive.");
      }
    }

    if (name !== undefined) {
      const dupCheck = await client.query(
        `
        SELECT 1
        FROM user_group
        WHERE LOWER(name) = LOWER($1)
          AND builder_id = $2
          AND user_group_id != $3
          AND is_active = true
        LIMIT 1;
        `,
        [name.trim(), builderId, id],
      );

      if (dupCheck.rowCount > 0) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "A user group with this name already exists.",
        );
      }
    }

    if (users_id !== undefined) {
      if (!Array.isArray(users_id)) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "users_id must be an array.");
      }

      if (users_id.length > 0) {
        const usersValidationQuery = `
          SELECT users_id
          FROM users
          WHERE users_id = ANY($1::uuid[])
            AND is_deleted = false
            AND is_verified = true;
        `;

        const usersValidationResult = await client.query(usersValidationQuery, [
          users_id,
        ]);

        if (usersValidationResult.rowCount !== users_id.length) {
          await client.query("ROLLBACK");
          return errorResponse(
            res,
            400,
            "One or more users are invalid or not verified.",
          );
        }
      }
    }

    const updateFields = [];
    const updateValues = [];
    let i = 1;

    const push = (column, value) => {
      updateFields.push(`${column} = $${i++}`);
      updateValues.push(value);
    };

    if (name !== undefined) {
      push("name", name);
    }

    if (users_id !== undefined) {
      push("users_id", users_id);
    }

    if (statusInBody) {
      if (typeof is_active !== "boolean") {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "'is_active' must be a boolean value.");
      }
      push("is_active", is_active);
    }

    push("updated_by_id", userId);
    updateFields.push("updated_at = NOW()");

    if (updateFields.length === 2) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "At least one field is required to update.",
      );
    }

    updateValues.push(id, builderId);

    const updateQuery = `
      UPDATE user_group
      SET ${updateFields.join(", ")}
      WHERE user_group_id = $${i++}
        AND builder_id = $${i}
      RETURNING user_group_id,
        company_id,
        builder_id,
        name,
        users_id,
        is_active,
        created_by_id,
        updated_by_id,
        created_at,
        updated_at;
    `;

    const result = await client.query(updateQuery, updateValues);

    if (result.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "Failed to update user group.");
    }

    const updatedGroup = result.rows[0];
    let usersDetails = [];
    if (updatedGroup.users_id && updatedGroup.users_id.length > 0) {
      const usersQuery = `
        SELECT users_id, name
        FROM users
        WHERE users_id = ANY($1::uuid[])
          AND is_deleted = false
          AND is_verified = true
      `;
      const usersResult = await client.query(usersQuery, [
        updatedGroup.users_id,
      ]);
      usersDetails = usersResult.rows.map((user) => ({
        id: user.users_id,
        name: user.name,
      }));
    }

    await client.query("COMMIT");

    const response = {
      ...keysToCamelCase({
        user_group_id: updatedGroup.user_group_id,
        company_id: updatedGroup.company_id,
        builder_id: updatedGroup.builder_id,
        name: updatedGroup.name,
        is_active: updatedGroup.is_active,
        created_by_id: updatedGroup.created_by_id,
        updated_by_id: updatedGroup.updated_by_id,
        created_at: updatedGroup.created_at,
        updated_at: updatedGroup.updated_at,
      }),
      users: usersDetails,
    };

    return successResponse(res, response, "User group updated successfully.");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Update user group error:", error);
    return errorResponse(res, 500, "Internal server error.");
  } finally {
    client.release();
  }
}

export async function updateUserGroupIsActive(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.user_id;
    const { id } = req.params;

    if (!id) {
      return errorResponse(res, 400, "user_group_id is required");
    }

    const existing = await client.query(
      `
      SELECT user_group_id, is_active
      FROM user_group
      WHERE user_group_id = $1
        AND (builder_id = $2 OR company_id = $3)
      `,
      [id, builderId || null, companyId || null],
    );

    if (existing.rowCount === 0) {
      return errorResponse(res, 404, "User group not found");
    }

    const currentIsActive = existing.rows[0].is_active;
    const newIsActive = !currentIsActive;

    const updateQuery = `
      UPDATE user_group
      SET
        is_active = $1,
        updated_by_id = $2,
        updated_at = CURRENT_TIMESTAMP
      WHERE user_group_id = $3
      RETURNING user_group_id, is_active;
    `;

    const updated = await client.query(updateQuery, [newIsActive, userId, id]);

    return successResponse(
      res,
      keysToCamelCase(updated.rows[0]),
      "User group status updated successfully.",
    );
  } catch (error) {
    console.error("Error updating user_group is_active:", error);
    return errorResponse(res, 500, error?.message || "Internal Server Error");
  } finally {
    client.release();
  }
}
