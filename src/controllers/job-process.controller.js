const getPool = require("../config/database");
const { successResponse, errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.createJobProcess = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const companyId = req.user?.company_id;
    const { name, description, is_active = true } = req.body;

    if (!companyId) {
      await client.query("ROLLBACK");
      return errorResponse(res, 401, "Unauthorized.");
    }

    const duplicateCheck = await client.query(
      `
      SELECT job_process_id
      FROM job_process
      WHERE LOWER(name) = LOWER($1)
        AND company_id = $2
      LIMIT 1;
      `,
      [name.trim(), companyId]
    );

    if (duplicateCheck.rowCount > 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        409,
        "Job process with this name already exists."
      );
    }

    const insertQuery = `
      INSERT INTO job_process (
        company_id,
        name,
        description,
        is_active
      )
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;

    const result = await client.query(insertQuery, [
      companyId,
      name.trim(),
      description || null,
      is_active,
    ]);

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Job process created successfully."
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error creating job process:", error);
    return errorResponse(res, 500, "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.getJobProcesses = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const companyId = req.user?.company_id;
    const { page = 1, limit = 25 } = req.query;

    if (!companyId) {
      return errorResponse(res, 401, "Unauthorized.");
    }

    const offset = (page - 1) * limit;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM job_process
      WHERE company_id = $1
    `;

    const countResult = await client.query(countQuery, [companyId]);
    const total = parseInt(countResult.rows[0].total);

    const selectQuery = `
      SELECT *
      FROM job_process
      WHERE company_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await client.query(selectQuery, [companyId, limit, offset]);

    return successResponse(
      res,
      {
        jobProcesses: keysToCamelCase(result.rows),
        pagination: {
          currentPage: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
      "Job processes retrieved successfully."
    );
  } catch (error) {
    console.error("Error retrieving job processes:", error);
    return errorResponse(res, 500, "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.deleteJobProcess = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const companyId = req.user?.company_id;
    const { id } = req.params;

    if (!companyId) {
      return errorResponse(res, 401, "Unauthorized.");
    }

    await client.query("BEGIN");

    const checkQuery = `
      SELECT job_process_id 
      FROM job_process 
      WHERE job_process_id = $1 AND company_id = $2
    `;
    const checkResult = await client.query(checkQuery, [id, companyId]);

    if (checkResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        404,
        "Job process not found or unauthorized to delete."
      );
    }

    const deleteQuery = `
      DELETE FROM job_process
      WHERE job_process_id = $1 AND company_id = $2
    `;
    await client.query(deleteQuery, [id, companyId]);

    await client.query("COMMIT");

    return successResponse(res, null, "Job process deleted successfully.");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error deleting job process:", error);
    return errorResponse(res, 500, "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.updateJobProcess = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const companyId = req.user?.company_id;
    const { id } = req.params;
    const { name, description } = req.body;

    if (!companyId) {
      return errorResponse(res, 401, "Unauthorized.");
    }

    if (!name && description === undefined) {
      return errorResponse(res, 400, "No fields provided to update.");
    }

    await client.query("BEGIN");

    const checkQuery = `
      SELECT job_process_id 
      FROM job_process 
      WHERE job_process_id = $1 AND company_id = $2
    `;
    const checkResult = await client.query(checkQuery, [id, companyId]);

    if (checkResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        404,
        "Job process not found or unauthorized to update."
      );
    }

    if (name) {
      const duplicateCheck = await client.query(
        `
        SELECT job_process_id
        FROM job_process
        WHERE LOWER(name) = LOWER($1)
          AND company_id = $2
          AND job_process_id != $3
        LIMIT 1;
        `,
        [name.trim(), companyId, id]
      );

      if (duplicateCheck.rowCount > 0) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          409,
          "Job process with this name already exists."
        );
      }
    }

    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (name !== undefined) {
      fields.push(`name = $${paramIndex++}`);
      values.push(name.trim());
    }

    if (description !== undefined) {
      fields.push(`description = $${paramIndex++}`);
      values.push(description || null);
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);
    values.push(companyId);

    const updateQuery = `
      UPDATE job_process
      SET ${fields.join(", ")}
      WHERE job_process_id = $${paramIndex++} AND company_id = $${paramIndex++}
      RETURNING *;
    `;

    const result = await client.query(updateQuery, values);
    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Job process updated successfully."
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error updating job process:", error);
    return errorResponse(res, 500, "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.toggleJobProcessIsActive = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const companyId = req.user?.company_id;
    const { id } = req.params;

    if (!companyId) {
      return errorResponse(res, 401, "Unauthorized.");
    }

    await client.query("BEGIN");

    const checkQuery = `
      SELECT job_process_id, is_active
      FROM job_process 
      WHERE job_process_id = $1 AND company_id = $2
    `;
    const checkResult = await client.query(checkQuery, [id, companyId]);

    if (checkResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        404,
        "Job process not found or unauthorized to update."
      );
    }

    const currentStatus = checkResult.rows[0].is_active;
    const newStatus = !currentStatus;

    const updateQuery = `
      UPDATE job_process
      SET is_active = $1, updated_at = NOW()
      WHERE job_process_id = $2 AND company_id = $3
      RETURNING *;
    `;

    const result = await client.query(updateQuery, [newStatus, id, companyId]);
    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      `Job process ${newStatus ? "activated" : "deactivated"} successfully.`
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error toggling job process status:", error);
    return errorResponse(res, 500, "Internal Server Error");
  } finally {
    client.release();
  }
};
