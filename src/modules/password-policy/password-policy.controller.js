const getPool = require("../../config/database");
const { successResponse, errorResponse } = require("../../helper/response");
const { keysToCamelCase } = require("../../utils/common");

exports.createPasswordPolicy = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user.builder_id;
    const userId = req.user.user_id;
    const companyId = req.user?.company_id;

    const {
      expires_in_days,
      invalid_attempt_limit,
      alert_before_expiry_days,
      password_history_count,
      enforce_strong_password,
      is_active,
    } = req.body;

    await client.query("BEGIN");

    // Allow only ONE password policy per builder
    const existingPolicy = await client.query(
      `SELECT 1 FROM password_policy WHERE builder_id = $1 LIMIT 1;`,
      [builderId]
    );

    if (existingPolicy.rowCount > 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "Password policy already exists for this builder."
      );
    }

    const insertQuery = `
      INSERT INTO password_policy (
        company_id,
        builder_id,
        expires_in_days,
        invalid_attempt_limit,
        alert_before_expiry_days,
        password_history_count,
        enforce_strong_password,
        is_active,
        created_by,
        updated_by
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *;
    `;
    const values = [
      companyId,
      builderId,
      expires_in_days || 90,
      invalid_attempt_limit || 5,
      alert_before_expiry_days || 7,
      password_history_count || 5,
      enforce_strong_password || true,
      is_active || true,
      userId || null,
      userId || null,
    ];

    const result = await client.query(insertQuery, values);
    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Password policy created successfully."
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error creating password policy:", error);
    return errorResponse(res, 500, error?.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.updatePasswordPolicy = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user.builder_id;
    const userId = req.user.user_id;
    const companyId = req.user?.company_id;

    if (!builderId || !companyId) {
      return errorResponse(res, 401, "Unauthorized.");
    }

    const {
      expires_in_days,
      invalid_attempt_limit,
      alert_before_expiry_days,
      password_history_count,
      enforce_strong_password,
    } = req.body;

    const fields = [];
    const values = [];
    let idx = 1;

    if (expires_in_days !== undefined) {
      fields.push(`expires_in_days = $${idx}`);
      values.push(expires_in_days);
      idx++;
    }
    if (invalid_attempt_limit !== undefined) {
      fields.push(`invalid_attempt_limit = $${idx}`);
      values.push(invalid_attempt_limit);
      idx++;
    }
    if (alert_before_expiry_days !== undefined) {
      fields.push(`alert_before_expiry_days = $${idx}`);
      values.push(alert_before_expiry_days);
      idx++;
    }
    if (password_history_count !== undefined) {
      fields.push(`password_history_count = $${idx}`);
      values.push(password_history_count);
      idx++;
    }
    if (enforce_strong_password !== undefined) {
      fields.push(`enforce_strong_password = $${idx}`);
      values.push(enforce_strong_password);
      idx++;
    }

    if (fields.length === 0) {
      return errorResponse(
        res,
        400,
        "At least one field is required to update."
      );
    }

    fields.push(`updated_by = $${idx}`);
    values.push(userId);
    idx++;

    fields.push(`updated_at = NOW()`);

    const updateQuery = `
      UPDATE password_policy
      SET ${fields.join(", ")}
      WHERE builder_id = $${idx} 
        AND company_id = $${idx + 1} 
        AND is_active = true
      RETURNING *;
    `;
    values.push(builderId, companyId);

    const result = await client.query(updateQuery, values);

    if (result.rowCount === 0) {
      return errorResponse(res, 404, "password policy not found.");
    }

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Password policy updated successfully."
    );
  } catch (error) {
    console.error("Error updating password policy:", error);
    return errorResponse(res, 500, error.message || "Internal server error");
  } finally {
    client.release();
  }
};

exports.updatePasswordPolicyIsActive = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const userId = req.user?.user_id;
    const companyId = req.user?.company_id;
    const { is_active } = req.body;

    if (!builderId || !companyId) {
      return errorResponse(res, 401, "Unauthorized");
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
      SELECT *
      FROM password_policy
      WHERE builder_id = $1
        AND company_id = $2
      LIMIT 1
      `,
      [builderId, companyId]
    );

    if (existing.rowCount === 0) {
      return errorResponse(
        res,
        404,
        "Password policy not found for this builder"
      );
    }

    const updateQuery = `
      UPDATE password_policy
      SET
        is_active = $1,
        updated_by = $2,
        updated_at = NOW()
      WHERE builder_id = $3
        AND company_id = $4
      RETURNING *;
    `;

    const updated = await client.query(updateQuery, [
      is_active,
      userId,
      builderId,
      companyId,
    ]);

    return successResponse(
      res,
      keysToCamelCase(updated.rows[0]),
      "Password policy status updated successfully."
    );
  } catch (error) {
    console.error("Error updating password policy is_active:", error);
    return errorResponse(res, 500, error?.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.getPasswordPolicy = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { company_id, builder_id, user_id } = req.user;

    if (!company_id && !builder_id) {
      return errorResponse(res, 400, "Company or builder context is required");
    }

    let result = await client.query(
      `SELECT * FROM password_policy
       WHERE company_id = $1 AND builder_id = $2
       LIMIT 1`,
      [company_id, builder_id]
    );

    if (result.rowCount === 0) {
      result = await client.query(
        `INSERT INTO password_policy 
          (company_id, builder_id, created_by, updated_by)
         VALUES ($1, $2, $3, $3)
         RETURNING *`,
        [company_id, builder_id, user_id]
      );
    }

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Password policy fetched successfully"
    );
  } catch (error) {
    return errorResponse(res, 500, error.message);
  } finally {
    client.release();
  }
};
