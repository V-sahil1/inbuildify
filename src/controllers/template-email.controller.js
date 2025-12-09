const getPool = require("../config/database");
const { errorResponse, successResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.createTemplateEmail = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user.builder_id;
    const companyId = req.user.company_id;
    const userId = req.user.user_id;

    const {
      name,
      type,
      subject,
      email_content,
      additional_recipient_users = [],
      additional_recipient_groups = [],
      is_active = true,
    } = req.body;

    await client.query("BEGIN");

    const builderCheck = await client.query(
      `SELECT builder_id FROM builder WHERE builder_id = $1`,
      [builderId]
    );
    if (builderCheck.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "Invalid builder.");
    }

    const userCheck = await client.query(
      `SELECT users_id FROM users WHERE users_id = $1 AND is_deleted = false`,
      [userId]
    );
    if (userCheck.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "Invalid user.");
    }

    if (additional_recipient_users.length > 0) {
      const usersCheck = await client.query(
        `SELECT users_id FROM users WHERE  users_id = ANY($1) AND is_deleted = false`,
        [additional_recipient_users]
      );
      if (usersCheck.rowCount !== additional_recipient_users.length) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "One or more recipient users are invalid or do not belong to this builder."
        );
      }
    }

    if (additional_recipient_groups.length > 0) {
      const groupsCheck = await client.query(
        `SELECT user_group_id FROM user_group WHERE builder_id = $1 AND user_group_id = ANY($2)`,
        [builderId, additional_recipient_groups]
      );
      if (groupsCheck.rowCount !== additional_recipient_groups.length) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "One or more recipient groups are invalid or do not belong to this builder."
        );
      }
    }

    if (additional_recipient_groups.length > 0) {
      const groupsCheck = await client.query(
        `SELECT user_group_id FROM user_group WHERE builder_id = $1 AND user_group_id = ANY($2) AND is_active = true`,
        [builderId, additional_recipient_groups]
      );
      if (groupsCheck.rowCount !== additional_recipient_groups.length) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "One or more recipient groups are inactive."
        );
      }
    }

    const duplicateCheck = await client.query(
      `
      SELECT template_email_id
      FROM template_email
      WHERE LOWER(name) = LOWER($1)
        AND company_id = $2
        AND builder_id = $3
      `,
      [name, companyId, builderId]
    );

    if (duplicateCheck.rowCount > 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        409,
        "Template email with this name already exists."
      );
    }

    const insertQuery = `
      INSERT INTO template_email (
        company_id,
        builder_id,
        name,
        type,
        subject,
        email_content,
        additional_recipient_users,
        additional_recipient_groups,
        is_active,
        created_by,
        updated_by
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING *;
    `;

    const insertValues = [
      companyId,
      builderId,
      name,
      type || "standard",
      subject || null,
      email_content,
      additional_recipient_users,
      additional_recipient_groups,
      is_active,
      userId,
      userId,
    ];

    const result = await client.query(insertQuery, insertValues);
    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Template email created successfully."
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Create Template Email Error:", error);
    return errorResponse(res, 500, "Failed to create template email.");
  } finally {
    client.release();
  }
};

exports.getAllTemplateEmails = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user.builder_id;
    const companyId = req.user.company_id;
    const { page = 1, limit = 25 } = req.query;

    const limitValue = parseInt(limit, 10);
    const pageValue = parseInt(page, 10);
    const offset = (pageValue - 1) * limitValue;

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM template_email
      WHERE (builder_id = $1 OR company_id = $2)
    `;
    const countResult = await client.query(countQuery, [builderId, companyId]);
    const totalRecords = parseInt(countResult.rows[0].total, 10);

    const dataQuery = `
      SELECT 
        template_email_id,
        company_id,
        builder_id,
        name,
        type,
        subject,
        email_content,
        additional_recipient_users,
        additional_recipient_groups,
        is_active,
        created_by,
        updated_by,
        created_at,
        updated_at
      FROM template_email
      WHERE (builder_id = $1 OR company_id = $2)
      ORDER BY created_at DESC
      LIMIT $3 OFFSET $4
    `;
    const result = await client.query(dataQuery, [
      builderId,
      companyId,
      limitValue,
      offset,
    ]);

    const response = {
      records: keysToCamelCase(result.rows),
      pagination: {
        currentPage: pageValue,
        totalPages: Math.ceil(totalRecords / limitValue),
        totalRecords,
        limit: limitValue,
      },
    };

    return successResponse(
      res,
      response,
      "Template emails fetched successfully."
    );
  } catch (error) {
    console.error("Get Template Emails Error:", error);
    return errorResponse(res, 500, "Failed to fetch template emails.");
  } finally {
    client.release();
  }
};

exports.updateTemplateEmail = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();
  const { id } = req.params;
  const builderId = req.user.builder_id;
  const companyId = req.user.company_id;
  const userId = req.user.user_id;

  const {
    name,
    type,
    subject,
    email_content,
    additional_recipient_users,
    additional_recipient_groups,
    is_active,
  } = req.body;

  try {
    const checkQuery = `
      SELECT * FROM template_email 
      WHERE template_email_id = $1 
      AND (builder_id = $2 OR company_id = $3)
    `;
    const checkResult = await client.query(checkQuery, [
      id,
      builderId,
      companyId,
    ]);
    if (checkResult.rows.length === 0) {
      return errorResponse(
        res,
        404,
        "Template email not found or unauthorized access."
      );
    }

    const currentIsActive = checkResult.rows[0].is_active;

    const updatingOtherFields =
      name ||
      type ||
      subject ||
      email_content ||
      additional_recipient_users ||
      additional_recipient_groups;

    const requestedIsActiveTrue = is_active === true || is_active === "true";
    const requestedIsActiveFalse = is_active === false || is_active === "false";

    if (!updatingOtherFields && is_active === undefined) {
      return errorResponse(
        res,
        400,
        "At least one field is required to update."
      );
    }

    if (currentIsActive === true && is_active !== undefined) {
      if (requestedIsActiveFalse) {
        if (updatingOtherFields) {
          return errorResponse(
            res,
            403,
            "To deactivate an active email template, 'is_active' must be the only field provided in the request."
          );
        }
      }
    }

    if (currentIsActive === false) {
      if (requestedIsActiveTrue) {
        if (updatingOtherFields) {
          return errorResponse(
            res,
            403,
            "To activate an inactive email template, 'is_active' must be the only field provided in the request."
          );
        }
      }

      if (updatingOtherFields) {
        return errorResponse(
          res,
          403,
          "Cannot update non-'is_active' fields when the email template is currently inactive. Only 'is_active' can be changed (to true)."
        );
      }

      if (is_active !== undefined) {
        if (requestedIsActiveFalse) {
          return errorResponse(
            res,
            403,
            "Email template is already inactive. 'is_active' can only be updated to true from this state."
          );
        }
      }
    }

    if (name) {
      const duplicateCheckQuery = `
        SELECT template_email_id
        FROM template_email
        WHERE LOWER(name) = LOWER($1)
          AND (builder_id = $2 OR company_id = $3)
          AND template_email_id != $4
      `;
      const duplicateResult = await client.query(duplicateCheckQuery, [
        name,
        builderId,
        companyId,
        id,
      ]);

      if (duplicateResult.rows.length > 0) {
        return errorResponse(
          res,
          409,
          "A template email with this name already exists for this builder/company."
        );
      }
    }

    if (
      Array.isArray(additional_recipient_users) &&
      additional_recipient_users.length > 0
    ) {
      const usersCheck = await client.query(
        `SELECT users_id FROM users WHERE users_id = ANY($1) AND is_deleted = false`,
        [additional_recipient_users]
      );
      if (usersCheck.rowCount !== additional_recipient_users.length) {
        return errorResponse(
          res,
          400,
          "One or more recipient users are invalid or do not belong to this builder."
        );
      }
    }

    if (
      Array.isArray(additional_recipient_groups) &&
      additional_recipient_groups.length > 0
    ) {
      const groupValidationQuery = `
        SELECT user_group_id FROM user_group 
        WHERE user_group_id = ANY($1) AND (builder_id = $2 OR company_id = $3)
      `;
      const groupCheck = await client.query(groupValidationQuery, [
        additional_recipient_groups,
        builderId,
        companyId,
      ]);

      if (groupCheck.rows.length !== additional_recipient_groups.length) {
        return errorResponse(res, 400, "One or more user groups are invalid.");
      }
    }

    {
      const groupActiveQuery = `
        SELECT user_group_id FROM user_group 
        WHERE user_group_id = ANY($1) AND (builder_id = $2 OR company_id = $3) AND is_active = true
      `;
      const groupCheck = await client.query(groupActiveQuery, [
        additional_recipient_groups,
        builderId,
        companyId,
      ]);

      if (groupCheck.rows.length !== additional_recipient_groups.length) {
        return errorResponse(res, 400, "One or more user groups are inactive.");
      }
    }

    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (name) {
      fields.push(`name = $${paramIndex++}`);
      values.push(name);
    }
    if (type) {
      fields.push(`type = $${paramIndex++}`);
      values.push(type);
    }
    if (subject) {
      fields.push(`subject = $${paramIndex++}`);
      values.push(subject);
    }
    if (email_content) {
      fields.push(`email_content = $${paramIndex++}`);
      values.push(email_content);
    }
    if (additional_recipient_users) {
      fields.push(`additional_recipient_users = $${paramIndex++}`);
      values.push(additional_recipient_users);
    }
    if (additional_recipient_groups) {
      fields.push(`additional_recipient_groups = $${paramIndex++}`);
      values.push(additional_recipient_groups);
    }
    if (is_active !== undefined) {
      fields.push(`is_active = $${paramIndex++}`);
      values.push(is_active);
    }

    fields.push(`updated_by = $${paramIndex++}`);
    values.push(userId);

    fields.push(`updated_at = NOW()`);

    const updateQuery = `
      UPDATE template_email
      SET ${fields.join(", ")}
      WHERE template_email_id = $${paramIndex++}
      RETURNING *;
    `;
    values.push(id);

    const result = await client.query(updateQuery, values);

    return successResponse(
      res,
      result.rows[0],
      "Template email updated successfully."
    );
  } catch (error) {
    console.error("Update Template Email Error:", error);
    return errorResponse(res, 500, "Failed to update template email.");
  } finally {
    client.release();
  }
};

exports.deleteTemplateEmail = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user.builder_id;
    const companyId = req.user.company_id;
    const userId = req.user.user_id;
    const { template_email_id } = req.params;

    await client.query("BEGIN");

    const builderCheck = await client.query(
      `SELECT builder_id FROM builder WHERE builder_id = $1`,
      [builderId]
    );
    if (builderCheck.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "Invalid builder.");
    }

    const userCheck = await client.query(
      `SELECT users_id FROM users WHERE users_id = $1`,
      [userId]
    );
    if (userCheck.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "Invalid user.");
    }

    const templateCheck = await client.query(
      `
      SELECT template_email_id 
      FROM template_email
      WHERE template_email_id = $1
        AND company_id = $2
        AND builder_id = $3
      `,
      [template_email_id, companyId, builderId]
    );

    if (templateCheck.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        404,
        "Template email not found or does not belong to this builder."
      );
    }

    await client.query(
      `
      DELETE FROM template_email 
      WHERE template_email_id = $1
      `,
      [template_email_id]
    );

    await client.query("COMMIT");

    return successResponse(res, null, "Template email deleted successfully.");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Delete Template Email Error:", error);
    return errorResponse(res, 500, "Failed to delete template email.");
  } finally {
    client.release();
  }
};
