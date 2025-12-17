const getPool = require("../config/database");
const { successResponse, errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

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

exports.getPasswordPolicyByUser = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId) {
      return errorResponse(res, 400, "Builder ID not found in user context.");
    }

    await client.query("BEGIN");

    // Get only this builder's password policy
    const policyQuery = `
      SELECT *
      FROM password_policy
      WHERE builder_id = $1 AND company_id = $2
      LIMIT 1;
    `;
    const policyResult = await client.query(policyQuery, [
      builderId,
      companyId,
    ]);

    await client.query("COMMIT");

    if (policyResult.rowCount === 0) {
      return errorResponse(
        res,
        404,
        "No password policy found for this builder."
      );
    }
    return successResponse(
      res,
      keysToCamelCase(policyResult.rows[0]),
      "Password policy fetched successfully."
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error egtting pssword policy:", error);
    return errorResponse(res, 500, error.message || "Internal server error");
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
    const { password_policy_id } = req.params;

    const {
      expires_in_days,
      invalid_attempt_limit,
      alert_before_expiry_days,
      password_history_count,
      enforce_strong_password,
    } = req.body;

    const updatingOtherFields =
      expires_in_days !== undefined ||
      invalid_attempt_limit !== undefined ||
      alert_before_expiry_days !== undefined ||
      password_history_count !== undefined ||
      enforce_strong_password !== undefined;

    if (!password_policy_id) {
      return errorResponse(res, 400, "password_policy_id is required.");
    }

    await client.query("BEGIN");

    const exist = await client.query(
      `SELECT * FROM password_policy 
       WHERE password_policy_id = $1 AND builder_id = $2`,
      [password_policy_id, builderId]
    );

    if (exist.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Password policy not found.");
    }

    const existActive = await client.query(
      `SELECT * FROM password_policy 
       WHERE password_policy_id = $1 AND builder_id = $2 AND is_active = true`,
      [password_policy_id, builderId]
    );

    if (existActive.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "inactive password policy.");
    }

    // const currentIsActive = exist.rows[0].is_active;

    // const requestedIsActiveTrue = is_active === true || is_active === "true";
    // const requestedIsActiveFalse = is_active === false || is_active === "false";

    // if (currentIsActive === true && is_active !== undefined) {
    //   if (requestedIsActiveFalse) {
    //     if (updatingOtherFields) {
    //       await client.query("ROLLBACK");
    //       return errorResponse(
    //         res,
    //         403,
    //         "To deactivate an active password policy, 'is_active' must be the only field provided in the request."
    //       );
    //     }
    //   }
    // }

    // if (currentIsActive === false) {
    //   if (requestedIsActiveTrue) {
    //     if (updatingOtherFields) {
    //       await client.query("ROLLBACK");
    //       return errorResponse(
    //         res,
    //         403,
    //         "To activate an inactive password policy, 'is_active' must be the only field provided in the request."
    //       );
    //     }
    //   }

    //   if (updatingOtherFields) {
    //     await client.query("ROLLBACK");
    //     return errorResponse(
    //       res,
    //       403,
    //       "Cannot update non-'is_active' fields when the password policy is currently inactive. Only 'is_active' can be changed (to true)."
    //     );
    //   }

    //   if (is_active !== undefined) {
    //     if (requestedIsActiveFalse) {
    //       await client.query("ROLLBACK");
    //       return errorResponse(
    //         res,
    //         403,
    //         "Password policy is already inactive. 'is_active' can only be updated to true from this state."
    //       );
    //     }
    //   }
    // }

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
      await client.query("ROLLBACK");
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
      WHERE password_policy_id = $${idx}
      AND builder_id = $${idx + 1}
      AND company_id = $${idx + 2}
      RETURNING *;
    `;

    values.push(password_policy_id, builderId, companyId);

    const result = await client.query(updateQuery, values);

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Password policy updated successfully."
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error updating password policy:", error);
    return errorResponse(res, 500, error.message);
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
    const { password_policy_id } = req.params;
    const { is_active } = req.body;

    if (!password_policy_id) {
      return errorResponse(res, 400, "Password policy id is required");
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
      SELECT password_policy_id
      FROM password_policy
      WHERE password_policy_id = $1
        AND builder_id = $2
      `,
      [password_policy_id, builderId]
    );

    if (existing.rowCount === 0) {
      return errorResponse(
        res,
        404,
        "password policy not found for this builder"
      );
    }

    const updateQuery = `
      UPDATE password_policy
      SET
        is_active = $1,
        updated_by = $2,
        updated_at = NOW()
      WHERE password_policy_id = $3
      RETURNING *;
    `;

    const updated = await client.query(updateQuery, [
      is_active,
      userId,
      password_policy_id,
    ]);

    return successResponse(
      res,
      keysToCamelCase(updated.rows[0]),
      "password policy status updated successfully."
    );
  } catch (error) {
    console.error("Error updating password policy is_active:", error);
    return errorResponse(res, 500, error?.message || "Internal Server Error");
  } finally {
    client.release();
  }
};
