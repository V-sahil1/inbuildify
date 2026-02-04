const getPool = require("../config/database");
const { successResponse, errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.createJobVariationApproval = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.users_id;

    const { role_id, amount } = req.body;

    if (!companyId && !builderId) {
      return errorResponse(res, 401, "Unauthorized.");
    }

    await client.query("BEGIN");

    const roleCheckQuery = `
      SELECT role_id 
      FROM role 
      WHERE role_id = $1 
    `;
    const roleResult = await client.query(roleCheckQuery, [role_id]);

    if (roleResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Role not found or unauthorized.");
    }

    const duplicateCheckQuery = `
      SELECT job_variation_approval_id
      FROM job_variation_approval
      WHERE role_id = $1
        AND (company_id = $2 OR builder_id = $3)
    `;
    const duplicateResult = await client.query(duplicateCheckQuery, [
      role_id,
      companyId,
      builderId,
    ]);

    if (duplicateResult.rowCount > 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 409, "Approval for this role already exists.");
    }

    const insertQuery = `
      INSERT INTO job_variation_approval (
        company_id,
        builder_id,
        role_id,
        amount,
        created_by,
        updated_by
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;

    const result = await client.query(insertQuery, [
      companyId,
      builderId,
      role_id,
      amount,
      userId,
      userId,
    ]);

    const roleQuery = `
      SELECT role_id, name
      FROM role
      WHERE role_id = $1
    `;
    const roleDataResult = await client.query(roleQuery, [role_id]);

    const roleDetails = roleDataResult.rows[0]
      ? {
          id: roleDataResult.rows[0].role_id,
          name: roleDataResult.rows[0].name,
        }
      : null;

    await client.query("COMMIT");

    const response = {
      ...keysToCamelCase(result.rows[0]),
      role: roleDetails,
    };

    return successResponse(
      res,
      response,
      "Job variation approval created successfully.",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error creating job variation approval:", error);
    return errorResponse(res, 500, "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.getJobVariationApprovals = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!companyId && !builderId) {
      return errorResponse(res, 401, "Unauthorized.");
    }

    const selectQuery = `
      SELECT 
        jva.*,
        r.name as role_name
      FROM job_variation_approval jva
      LEFT JOIN role r ON jva.role_id = r.role_id
      WHERE jva.company_id = $1 OR jva.builder_id = $2
      ORDER BY jva.created_at DESC;
    `;

    const result = await client.query(selectQuery, [companyId, builderId]);

    const formattedResults = result.rows.map((row) => ({
      ...keysToCamelCase({
        job_variation_approval_id: row.job_variation_approval_id,
        company_id: row.company_id,
        builder_id: row.builder_id,
        amount: row.amount,
        role: row.role_id
          ? {
              id: row.role_id,
              name: row.role_name,
            }
          : null,
        created_by: row.created_by,
        updated_by: row.updated_by,
        created_at: row.created_at,
        updated_at: row.updated_at,
      }),
    }));

    return successResponse(res, formattedResults);
  } catch (error) {
    console.error("Error fetching job variation approvals:", error);
    return errorResponse(res, 500, "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.deleteJobVariationApproval = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const { id } = req.params;

    if (!companyId && !builderId) {
      return errorResponse(res, 401, "Unauthorized.");
    }

    await client.query("BEGIN");

    const checkQuery = `
      SELECT job_variation_approval_id
      FROM job_variation_approval
      WHERE job_variation_approval_id = $1
        AND (company_id = $2 OR builder_id = $3)
    `;
    const checkResult = await client.query(checkQuery, [
      id,
      companyId,
      builderId,
    ]);

    if (checkResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        404,
        "Job variation approval not found or unauthorized to delete.",
      );
    }

    const deleteQuery = `
      DELETE FROM job_variation_approval
      WHERE job_variation_approval_id = $1
        AND (company_id = $2 OR builder_id = $3);
    `;

    await client.query(deleteQuery, [id, companyId, builderId]);
    await client.query("COMMIT");

    return successResponse(
      res,
      null,
      "Job variation approval deleted successfully.",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error deleting job variation approval:", error);
    return errorResponse(res, 500, "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.updateJobVariationApproval = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.users_id;
    const { id } = req.params;
    const { role_id, amount } = req.body;

    if (!companyId && !builderId) {
      return errorResponse(res, 401, "Unauthorized.");
    }

    if (!role_id && !amount) {
      return errorResponse(
        res,
        400,
        "At least one field must be provided for update.",
      );
    }

    await client.query("BEGIN");

    const checkQuery = `
      SELECT job_variation_approval_id
      FROM job_variation_approval
      WHERE job_variation_approval_id = $1
        AND (company_id = $2 OR builder_id = $3)
    `;
    const checkResult = await client.query(checkQuery, [
      id,
      companyId,
      builderId,
    ]);

    if (checkResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        404,
        "Job variation approval not found or unauthorized to update.",
      );
    }

    if (role_id) {
      const roleCheckQuery = `
        SELECT role_id 
        FROM role 
        WHERE role_id = $1 
      `;
      const roleResult = await client.query(roleCheckQuery, [role_id]);

      if (roleResult.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 404, "Role not found or unauthorized.");
      }

      const duplicateCheckQuery = `
        SELECT job_variation_approval_id
        FROM job_variation_approval
        WHERE role_id = $1
          AND (company_id = $2 OR builder_id = $3)
          AND job_variation_approval_id != $4
      `;
      const duplicateResult = await client.query(duplicateCheckQuery, [
        role_id,
        companyId,
        builderId,
        id,
      ]);

      if (duplicateResult.rowCount > 0) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          409,
          "Approval for this role already exists.",
        );
      }
    }

    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (role_id !== undefined) {
      fields.push(`role_id = $${paramIndex++}`);
      values.push(role_id);
    }

    if (amount !== undefined) {
      fields.push(`amount = $${paramIndex++}`);
      values.push(amount);
    }

    fields.push(`updated_by = $${paramIndex++}`);
    fields.push(`updated_at = NOW()`);
    values.push(userId);

    const updateQuery = `
      UPDATE job_variation_approval
      SET ${fields.join(", ")}
      WHERE job_variation_approval_id = $${paramIndex++}
        AND (company_id = $${paramIndex++} OR builder_id = $${paramIndex++})
      RETURNING *;
    `;

    values.push(id, companyId, builderId);

    const result = await client.query(updateQuery, values);

    const updatedRecord = result.rows[0];
    const roleQuery = `
      SELECT role_id, name
      FROM role
      WHERE role_id = $1
    `;
    const roleDataResult = await client.query(roleQuery, [
      updatedRecord.role_id,
    ]);

    const roleDetails = roleDataResult.rows[0]
      ? {
          id: roleDataResult.rows[0].role_id,
          name: roleDataResult.rows[0].name,
        }
      : null;

    await client.query("COMMIT");

    const response = {
      ...keysToCamelCase(updatedRecord),
      role: roleDetails,
    };

    return successResponse(
      res,
      response,
      "Job variation approval updated successfully.",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error updating job variation approval:", error);
    return errorResponse(res, 500, "Internal Server Error");
  } finally {
    client.release();
  }
};
