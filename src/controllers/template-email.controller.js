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

exports.getTemplateEmails = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.users_id;

    if (!builderId && !companyId) {
      return errorResponse(res, 401, "Unauthorized access.");
    }

    /* ✅ Static default templates */
    const staticTemplates = [
      {
        name: "1st Follow-up",
        type: "customized",
        subject: null,
        email_content: "",
        additional_users: [],
        additional_groups: [],
      },
      {
        name: "2nd Follow-up",
        type: "customized",
        subject: null,
        email_content: "",
        additional_users: [],
        additional_groups: [],
      },
      {
        name: "Acknowledgment mail to customer",
        type: "standard",
        subject: "[Logged User Name][jobAddress][First Name]",
        email_content:
          "<b>Maintenance task completed. Thank you for choosing us.</b>",
        additional_users: [
          "4ee3de64-552b-492f-95f9-529fbde1c590",
          "7a41ccd7-b0c6-4ed8-bcee-9d4c00cbdd56",
        ],
        additional_groups: [],
      },
      {
        name: "Agent Summary report",
        type: "standard",
        subject: null,
        email_content: "",
        additional_users: [],
        additional_groups: [],
      },
      {
        name: "Appointment booked with Customer",
        type: "standard",
        subject: null,
        email_content: "",
        additional_users: [],
        additional_groups: [],
      },
      {
        name: "Appointment Booked with ReferralPartner",
        type: "standard",
        subject: null,
        email_content: "",
        additional_users: [],
        additional_groups: [],
      },
      {
        name: "Appointment Cancellation",
        type: "customized",
        subject: null,
        email_content: "",
        additional_users: [],
        additional_groups: [],
      },
      {
        name: "Appointment with client",
        type: "customized",
        subject: null,
        email_content: "",
        additional_users: [],
        additional_groups: [],
      },
      {
        name: "Book Color Appointment",
        type: "customized",
        subject: null,
        email_content: "",
        additional_users: [],
        additional_groups: [],
      },
      {
        name: "Book Supplier",
        type: "customized",
        subject: null,
        email_content:
          "Please don't delete {SupplierResponseLink} if you want supplier response.",
        additional_users: [],
        additional_groups: [],
      },
    ];

    /* ✅ Check existing templates */
    const existingQuery = `
      SELECT template_email_id
      FROM template_email
      WHERE (company_id = $1 OR builder_id = $2)
    `;
    const existingResult = await client.query(existingQuery, [
      companyId,
      builderId,
    ]);

    /* ✅ Insert defaults if not exist */
    if (existingResult.rowCount === 0) {
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
        ) VALUES
        ${staticTemplates
          .map(
            (_, i) =>
              `($${i * 11 + 1}, $${i * 11 + 2}, $${i * 11 + 3}, $${i * 11 + 4},
                $${i * 11 + 5}, $${i * 11 + 6}, $${i * 11 + 7}, $${i * 11 + 8},
                $${i * 11 + 9}, $${i * 11 + 10}, $${i * 11 + 11})`
          )
          .join(", ")}
        RETURNING *;
      `;

      const insertValues = [];
      staticTemplates.forEach((t) => {
        insertValues.push(
          companyId,
          builderId,
          t.name,
          t.type,
          t.subject,
          t.email_content,
          t.additional_users,
          t.additional_groups,
          true,
          userId,
          userId
        );
      });

      const insertResult = await client.query(insertQuery, insertValues);

      const filtered = insertResult.rows.map(
        ({ company_id, builder_id, created_by, updated_by, ...rest }) => rest
      );

      return successResponse(
        res,
        keysToCamelCase(filtered),
        "Default email templates created and fetched successfully."
      );
    }

    /* ✅ Fetch existing templates */
    const fetchQuery = `
      SELECT *
      FROM template_email
      WHERE (company_id = $1 OR builder_id = $2)
      ORDER BY created_at ASC
    `;
    const result = await client.query(fetchQuery, [companyId, builderId]);

    const filtered = result.rows.map(
      ({ company_id, builder_id, created_by, updated_by, ...rest }) => rest
    );

    return successResponse(
      res,
      keysToCamelCase(filtered),
      "Template emails fetched successfully."
    );
  } catch (error) {
    console.error("Error fetching template emails:", error);
    return errorResponse(res, 500, "Internal server error.");
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

    const checkActiveQuery = `
      SELECT * FROM template_email 
      WHERE template_email_id = $1 
      AND (builder_id = $2 OR company_id = $3) AND is_active = true
    `;
    const checkActiveResult = await client.query(checkActiveQuery, [
      id,
      builderId,
      companyId,
    ]);
    if (checkActiveResult.rows.length === 0) {
      return errorResponse(res, 404, "Template email is inactive.");
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

    if (
      Array.isArray(additional_recipient_groups) &&
      additional_recipient_groups.length > 0
    ) {
      const groupValidationQuery = `
        SELECT user_group_id FROM user_group 
        WHERE user_group_id = ANY($1) AND (builder_id = $2 OR company_id = $3) AND is_active = true
      `;
      const groupCheck = await client.query(groupValidationQuery, [
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
      keysToCamelCase(result.rows[0]),
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

exports.updateTemplateEmailIsActive = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.users_id;

    const { id } = req.params;
    const { is_active } = req.body;

    if (!id) {
      return errorResponse(res, 400, "template_email_id is required");
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
      SELECT template_email_id
      FROM template_email
      WHERE template_email_id = $1
        AND (
          builder_id = $2
          OR company_id = $3
        )
      `,
      [id, builderId, companyId]
    );

    if (existing.rowCount === 0) {
      return errorResponse(res, 404, "Template email not found in your scope");
    }

    const updateQuery = `
      UPDATE template_email
      SET
        is_active = $1,
        updated_by = $2,
        updated_at = NOW()
      WHERE template_email_id = $3
      RETURNING *;
    `;

    const result = await client.query(updateQuery, [is_active, userId, id]);

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Template email status updated successfully"
    );
  } catch (error) {
    console.error("Error updating template email is_active:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
};
