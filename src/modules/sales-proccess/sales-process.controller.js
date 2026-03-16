import getPool from "../../config/database";
import { errorResponse, successResponse } from "../../helper/response";
import { keysToCamelCase } from "../../utils/common";

export async function createSalesProcess(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.user_id;
    const { name, is_default } = req.body;

    await client.query("BEGIN");

    const existingProcess = await client.query(
      `SELECT 1 
       FROM sales_process 
       WHERE builder_id = $1 AND name = $2 
       LIMIT 1;`,
      [builderId, name],
    );

    if (existingProcess.rowCount > 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "Sales process with this name already exists for this builder.",
      );
    }

    if (is_default) {
      await client.query(
        `
    UPDATE sales_process
    SET is_default = false,
        updated_by = $1,
        updated_at = NOW()
    WHERE builder_id = $2
      AND company_id = $3;
    `,
        [userId, builderId, companyId],
      );
    }

    const insertQuery = `
      INSERT INTO sales_process (
        company_id,
        builder_id,
        name,
        is_default,
        created_by,
        updated_by
      )
      VALUES ($1,$2,$3,$4,$5,$6)
      RETURNING *;
    `;

    const values = [
      companyId,
      builderId,
      name.trim(),
      is_default || false,
      userId,
      userId,
    ];

    const result = await client.query(insertQuery, values);
    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Sales process created successfully.",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error creating sales process:", error);
    return errorResponse(res, 500, error?.message || "Internal Server Error");
  } finally {
    client.release();
  }
}

export async function getAllSalesProcess(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    if (!builderId) {
      return errorResponse(res, 401, "Unauthorized: Builder ID missing.");
    }

    const query = `
      SELECT *
      FROM sales_process
      WHERE builder_id = $1
      ORDER BY created_at ASC;
    `;
    const result = await client.query(query, [builderId]);

    return successResponse(
      res,
      keysToCamelCase(result.rows),
      "Sales process list fetched successfully.",
    );
  } catch (error) {
    console.error("Error fetching sales process list:", error);
    return errorResponse(res, 500, error?.message || "Internal Server Error");
  } finally {
    client.release();
  }
}

export async function deleteSalesProcess(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const builderId = req.user.builder_id;

    if (!id) {
      return errorResponse(res, 400, "Sales process iD is required.");
    }
    const existingSales = await client.query(
      "SELECT sales_process_id FROM sales_process WHERE sales_process_id = $1 AND builder_id = $2",
      [id, builderId],
    );

    if (existingSales.rowCount === 0) {
      return errorResponse(
        res,
        404,
        "Sales process not found for this builder.",
      );
    }

    await client.query(
      "DELETE FROM sales_process WHERE sales_process_id = $1",
      [id],
    );

    return successResponse(res, null, "Sales process deleted successfully.");
  } catch (error) {
    console.error("Error deleting sales process:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
}

export async function updateSalesProcess(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const { id } = req.params;
    const { name, is_default } = req.body;

    if (!name && !is_default) {
      return errorResponse(
        res,
        400,
        "At least one field must be provided to update.",
      );
    }

    const existingSales = await client.query(
      "SELECT * FROM sales_process WHERE sales_process_id = $1 AND builder_id = $2",
      [id, builderId],
    );

    if (existingSales.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        404,
        "Sales process not found for this builder.",
      );
    }

    if (name) {
      const duplicateName = await client.query(
        `SELECT sales_process_id FROM sales_process 
         WHERE LOWER(name) = LOWER($1) 
         AND builder_id = $2 
         AND sales_process_id != $3`,
        [name, builderId, id],
      );

      if (duplicateName.rowCount > 0) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "Name already exists for another sales process.",
        );
      }
    }

    if (is_default === true) {
      await client.query(
        `
    UPDATE sales_process
    SET is_default = false,
        updated_by = $1,
        updated_at = NOW()
    WHERE builder_id = $2
      AND company_id = $3
      AND sales_process_id != $4;
    `,
        [req.user?.user_id, builderId, companyId, id],
      );
    }

    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (name) {
      fields.push(`name = $${paramIndex++}`);
      values.push(name);
    }
    if (is_default) {
      fields.push(`is_default = $${paramIndex++}`);
      values.push(is_default);
    }

    fields.push(`company_id = $${paramIndex++}`);
    values.push(companyId);

    fields.push("updated_at = NOW()");

    const updateQuery = `
      UPDATE sales_process 
      SET ${fields.join(", ")} 
      WHERE sales_process_id = $${paramIndex} 
      AND builder_id = $${paramIndex + 1}
      RETURNING *;
    `;

    values.push(id, builderId);

    const result = await client.query(updateQuery, values);

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Sales processr updated successfully.",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error updating sales process:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
}
