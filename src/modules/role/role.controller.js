import { successResponse, errorResponse } from "../../helper/response.js";
import { keysToCamelCase } from "../../utils/common.js";
import getPool from "../../config/database.js";

export async function createRole(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const userId = req.user?.user_id;
    const { name } = req.body;

    if (!name) {
      return errorResponse(res, 400, "Role name is required.");
    }

    await client.query("BEGIN");

    const duplicateCheck = await client.query(
      "SELECT 1 FROM role WHERE LOWER(name) = LOWER($1)",
      [name.trim()],
    );

    if (duplicateCheck.rowCount > 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "Role name already exists.");
    }

    const insertQuery = `
      INSERT INTO role (
        name,
        created_by,
        updated_by
      )
      VALUES ($1, $2, $3)
      RETURNING *;
    `;

    const values = [name.trim(), userId || null, userId || null];

    const result = await client.query(insertQuery, values);
    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Role created successfully.",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error creating role:", error);
    return errorResponse(res, 500, error?.message || "Internal Server Error");
  } finally {
    client.release();
  }
}

export async function getAllRole(req, res) {
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
      FROM role r
      ORDER BY r.created_at DESC
      LIMIT $1 OFFSET $2;
    `;

    const dataResult = await client.query(dataQuery, [limitValue, offset]);

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM role
    `;
    const countResult = await client.query(countQuery);
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
      "Role fetched successfully.",
    );
  } catch (error) {
    console.error("Error fetching role:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
}

export async function deleteRole(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { id } = req.params;

    if (!id) {
      return errorResponse(res, 400, "Role ID is required.");
    }
    const existingRole = await client.query(
      "SELECT role_id FROM role WHERE role_id = $1",
      [id],
    );

    if (existingRole.rowCount === 0) {
      return errorResponse(res, 404, "Role not found.");
    }

    await client.query("DELETE FROM role WHERE role_id = $1", [id]);

    return successResponse(res, null, "Role deleted successfully.");
  } catch (error) {
    console.error("Error deleting roke:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
}

export async function updateRole(req, res) {
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

    if (name !== undefined && name.trim() !== "") {
      const duplicateCheck = await client.query(
        `SELECT 1 FROM role 
         WHERE LOWER(name) = LOWER($1) 
         AND builder_id = $2 
         AND role_id != $3`,
        [name.trim(), builderId, role_id],
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

    fields.push("updated_at = NOW()");

    if (fields.length === 2 && !name && !type && !description) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "At least one field must be provided for update (name, type, description).",
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
      "Role updated successfully.",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error updating role:", error);
    return errorResponse(res, 500, error?.message || "Internal Server Error");
  } finally {
    client.release();
  }
}
