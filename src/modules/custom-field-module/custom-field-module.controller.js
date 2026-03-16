import getPool from "../../config/database";
import { successResponse, errorResponse } from "../../helper/response";
import { keysToCamelCase } from "../../utils/common";

export async function createCustomFieldModule(req, res) {
  const pool = getPool();
  const client = await pool.connect();
  const { name, description } = req.body;

  try {
    if (!name) {
      return errorResponse(res, 400, "Custom field module name is required.");
    }
    const existsName = await client.query(
      "SELECT * FROM custom_field_module WHERE name = $1",
      [name],
    );
    if (existsName.rowCount > 0) {
      return errorResponse(
        res,
        400,
        "Custom field module with this name already exists.",
      );
    }
    const query = `
      INSERT INTO custom_field_module (name, description)
      VALUES ($1, $2)
      RETURNING module_id, name, description, created_at, updated_at;
    `;

    const result = await client.query(query, [name, description]);

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Custom field module created successfully.",
    );
  } catch (error) {
    console.error(error);
    return errorResponse(res, 500, error?.message || "Internal Server Error");
  } finally {
    client.release();
  }
}

export async function getAllCustomFieldModule(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { page, limit } = req.query;

    const pageValue = parseInt(page) || 1;
    const limitValue = parseInt(limit) || 10;
    const offset = (pageValue - 1) * limitValue;

    const countQuery = "SELECT COUNT(*) AS total FROM custom_field_module;";
    const countResult = await client.query(countQuery);
    const total = parseInt(countResult.rows[0].total);

    const query = `
      SELECT 
        module_id,
        name,
        description,
        created_at,
        updated_at
      FROM custom_field_module
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2;
    `;
    const result = await client.query(query, [limitValue, offset]);

    return successResponse(
      res,
      {
        customFieldModules: keysToCamelCase(result.rows),
        pagination: {
          currentPage: pageValue,
          totalPages: Math.ceil(total / limitValue),
          totalRecords: total,
          limit: limitValue,
        },
      },
      "Custom field modules fetched successfully.",
    );
  } catch (error) {
    console.error("Error fetching custom field modules:", error);
    return errorResponse(res, 500, error?.message || "Internal Server Error");
  } finally {
    client.release();
  }
}

export async function deleteCustomFieldModule(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  const { module_id } = req.params;

  try {
    await client.query("BEGIN");

    const checkExists = await client.query(
      "SELECT * FROM custom_field_module WHERE module_id = $1",
      [module_id],
    );

    if (checkExists.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Custom field module not found.");
    }

    const deleteQuery = `
      DELETE FROM custom_field_module
      WHERE module_id = $1
      RETURNING module_id, name, description, created_at, updated_at;
    `;

    const result = await client.query(deleteQuery, [module_id]);

    await client.query("COMMIT");

    if (result.rowCount === 0) {
      return errorResponse(res, 404, "Failed to delete custom field module.");
    }

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Custom field module deleted successfully.",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error deleting custom field module:", error);
    return errorResponse(res, 500, error?.message || "Internal Server Error");
  } finally {
    client.release();
  }
}

export async function updateCustomFieldModule(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  const { module_id } = req.params;
  const { name, description } = req.body;

  try {
    await client.query("BEGIN");

    const existingModule = await client.query(
      "SELECT * FROM custom_field_module WHERE module_id = $1",
      [module_id],
    );

    if (existingModule.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Custom field module not found.");
    }

    if (name === undefined && description === undefined) {
      return errorResponse(
        res,
        400,
        "At least one field must be provided for update.",
      );
    }

    const existsName = await client.query(
      "SELECT * FROM custom_field_module WHERE name = $1",
      [name],
    );
    if (existsName.rowCount > 0) {
      return errorResponse(
        res,
        400,
        "Custom field module with this name already exists.",
      );
    }
    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (name !== undefined) {
      fields.push(`name = $${paramIndex++}`);
      values.push(name);
    }

    if (description !== undefined) {
      fields.push(`description = $${paramIndex++}`);
      values.push(description);
    }

    fields.push("updated_at = NOW()");

    const updateQuery = `
      UPDATE custom_field_module
      SET ${fields.join(", ")}
      WHERE module_id = $${paramIndex}
      RETURNING module_id, name, description, created_at, updated_at;
    `;

    values.push(module_id);

    const result = await client.query(updateQuery, values);

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Custom field module updated successfully.",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Update custom field module error:", error);
    return errorResponse(res, 500, error?.message || "Internal Server Error");
  } finally {
    client.release();
  }
}
