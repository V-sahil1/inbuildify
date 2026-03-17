import getPool from "../../config/database.js";
import { successResponse, errorResponse } from "../../helper/response.js";
import { keysToCamelCase } from "../../utils/common.js";

export async function createColorGroup(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.users_id;

    if (!builderId || !companyId) {
      return errorResponse(res, 401, "Unauthorized.");
    }

    const { name } = req.body;

    if (!name || name.trim() === "") {
      return errorResponse(res, 400, "Color group name is required.");
    }

    await client.query("BEGIN");

    const duplicateCheck = await client.query(
      `
      SELECT 1
      FROM color_group
      WHERE company_id = $1
        AND builder_id = $2
        AND LOWER(name) = LOWER($3)
      `,
      [companyId, builderId, name.trim()],
    );

    if (duplicateCheck.rowCount > 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        409,
        "Color group with this name already exists.",
      );
    }

    const insertQuery = `
      INSERT INTO color_group (
        company_id,
        builder_id,
        name,
        status,
        created_by,
        updated_by,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      RETURNING *;
    `;

    const values = [companyId, builderId, name.trim(), true, userId, userId];

    const result = await client.query(insertQuery, values);
    const createdColorGroup = keysToCamelCase(result.rows[0]);

    await client.query("COMMIT");

    return successResponse(
      res,
      createdColorGroup,
      "Color group created successfully.",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Create Color Group Error:", error);

    if (error.code === "23505") {
      return errorResponse(res, 409, "Color group name already exists.");
    }

    return errorResponse(res, 500, "Internal Server Error");
  } finally {
    client.release();
  }
}

export async function getAllColorGroups(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user.builder_id;
    const companyId = req.user.company_id;

    const { status, search } = req.query;

    const conditions = ["company_id = $1", "builder_id = $2"];
    const values = [companyId, builderId];
    let index = 3;

    if (status !== undefined) {
      if (!["true", "false"].includes(status)) {
        return errorResponse(res, 400, "status must be true or false");
      }
      conditions.push(`status = $${index}`);
      values.push(status === "true");
      index++;
    }

    if (search !== undefined && search.trim() !== "") {
      conditions.push(`LOWER(name) LIKE LOWER($${index})`);
      values.push(`%${search.trim()}%`);
      index++;
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const query = `
      SELECT *
      FROM color_group
      ${whereClause}
      ORDER BY created_at DESC;
    `;

    const result = await client.query(query, values);

    const rows = keysToCamelCase(result.rows);

    return successResponse(res, rows, "Color groups fetched successfully.");
  } catch (error) {
    console.error("Error fetching color groups:", error);
    return errorResponse(res, 500, error?.message || "Internal Server Error");
  } finally {
    client.release();
  }
}

export async function getColorGroupById(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user.builder_id;
    const companyId = req.user.company_id;
    const { colorGroupId } = req.params;

    if (!colorGroupId) {
      return errorResponse(res, 400, "Color group ID is required.");
    }

    const query = `
      SELECT *
      FROM color_group
      WHERE color_group_id = $1
        AND company_id = $2
        AND builder_id = $3
    `;

    const result = await client.query(query, [
      colorGroupId,
      companyId,
      builderId,
    ]);

    if (result.rowCount === 0) {
      return errorResponse(res, 404, "Color group not found.");
    }

    const colorGroup = keysToCamelCase(result.rows[0]);

    return successResponse(
      res,
      colorGroup,
      "Color group fetched successfully.",
    );
  } catch (error) {
    console.error("Error fetching color group:", error);
    return errorResponse(res, 500, error?.message || "Internal Server Error");
  } finally {
    client.release();
  }
}

export async function updateColorGroup(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user.builder_id;
    const companyId = req.user.company_id;
    const userId = req.user?.users_id;
    const { colorGroupId } = req.params;

    if (!colorGroupId) {
      return errorResponse(res, 400, "Color group ID is required.");
    }

    const { name, status } = req.body;

    await client.query("BEGIN");

    const existingCheck = await client.query(
      `
      SELECT color_group_id, name
      FROM color_group
      WHERE color_group_id = $1
        AND company_id = $2
        AND builder_id = $3
      `,
      [colorGroupId, companyId, builderId],
    );

    if (existingCheck.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Color group not found.");
    }

    const existing = existingCheck.rows[0];

    if (name && name.trim() !== existing.name) {
      const duplicateCheck = await client.query(
        `
        SELECT 1
        FROM color_group
        WHERE company_id = $1
          AND builder_id = $2
          AND LOWER(name) = LOWER($3)
          AND color_group_id != $4
        `,
        [companyId, builderId, name.trim(), colorGroupId],
      );

      if (duplicateCheck.rowCount > 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Color group name already exists.");
      }
    }

    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updateFields.push(`name = $${paramIndex++}`);
      updateValues.push(name.trim());
    }

    if (status !== undefined) {
      if (typeof status !== "boolean") {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Status must be a boolean value.");
      }
      updateFields.push(`status = $${paramIndex++}`);
      updateValues.push(status);
    }

    if (updateFields.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "At least one field is required for update.",
      );
    }

    updateFields.push(`updated_by = $${paramIndex++}`);
    updateValues.push(userId);
    updateFields.push("updated_at = NOW()");
    updateValues.push(colorGroupId);

    const updateQuery = `
      UPDATE color_group
      SET ${updateFields.join(", ")}
      WHERE color_group_id = $${paramIndex}
      RETURNING *;
    `;

    const result = await client.query(updateQuery, updateValues);
    const updatedColorGroup = keysToCamelCase(result.rows[0]);

    await client.query("COMMIT");

    return successResponse(
      res,
      updatedColorGroup,
      "Color group updated successfully.",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Update Color Group Error:", error);

    if (error.code === "23505") {
      return errorResponse(res, 409, "Color group name already exists.");
    }

    return errorResponse(res, 500, "Internal Server Error");
  } finally {
    client.release();
  }
}

export async function deleteColorGroup(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user.builder_id;
    const companyId = req.user.company_id;
    const { colorGroupId } = req.params;

    if (!colorGroupId) {
      return errorResponse(res, 400, "Color group ID is required.");
    }

    await client.query("BEGIN");

    const existingCheck = await client.query(
      `
      SELECT color_group_id
      FROM color_group
      WHERE color_group_id = $1
        AND company_id = $2
        AND builder_id = $3
      `,
      [colorGroupId, companyId, builderId],
    );

    if (existingCheck.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Color group not found.");
    }

    const updateColorCategoriesQuery = `
      UPDATE color_category 
      SET color_group = array_remove(color_group, $1)
      WHERE $1 = ANY(color_group)
    `;

    await client.query(updateColorCategoriesQuery, [colorGroupId]);

    await client.query(
      `
      DELETE FROM color_group
      WHERE color_group_id = $1
        AND company_id = $2
        AND builder_id = $3
      `,
      [colorGroupId, companyId, builderId],
    );

    await client.query("COMMIT");

    return successResponse(res, null, "Color group deleted successfully.");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Delete Color Group Error:", error);
    return errorResponse(res, 500, "Internal Server Error");
  } finally {
    client.release();
  }
}
