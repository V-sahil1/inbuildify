const getPool = require("../../config/database");
const { errorResponse, successResponse } = require("../../helper/response");
const { keysToCamelCase } = require("../../utils/common");
const { deleteFromS3 } = require("../../utils/s3Upload");

exports.createSchedulerEmail = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.users_id;

    const {
      name,
      frequency,
      send_to_all_active_users,
      notification_recipient_users,
      reply_to_users,
      subject,
      message_body,
      no_of_action_days,
      no_record_message,
      no_record_message_body,
      is_active,
    } = req.body;
    const attach_files = req.files?.location || req.body.attach_files || null;

    const duplicateQuery = `
      SELECT scheduler_email_id
      FROM scheduler_email
      WHERE name = $1
        AND ((builder_id IS NOT NULL AND builder_id = $2)
          OR (company_id IS NOT NULL AND company_id = $3))
    `;
    const duplicateResult = await client.query(duplicateQuery, [
      name,
      builderId,
      companyId,
    ]);

    if (duplicateResult.rows.length > 0) {
      return errorResponse(
        res,
        400,
        "A scheduler email with this name already exists for this builder/company.",
      );
    }

    if (
      notification_recipient_users &&
      notification_recipient_users.length > 0
    ) {
      const checkNotificationUsersQuery = `
    SELECT users_id 
    FROM users
    WHERE users_id = ANY($1::uuid[]) AND is_deleted = false AND is_verified = true
  `;
      const validNotificationUsers = await client.query(
        checkNotificationUsersQuery,
        [notification_recipient_users],
      );

      if (
        validNotificationUsers.rows.length !==
        notification_recipient_users.length
      ) {
        return errorResponse(
          res,
          400,
          "One or more provided notification recipient users are invalid.",
        );
      }
    }

    if (reply_to_users && reply_to_users.length > 0) {
      const checkReplyToUsersQuery = `
    SELECT users_id 
    FROM users
    WHERE users_id = ANY($1::uuid[]) AND is_deleted = false AND is_verified = true
  `;
      const validReplyToUsers = await client.query(checkReplyToUsersQuery, [
        reply_to_users,
      ]);

      if (validReplyToUsers.rows.length !== reply_to_users.length) {
        return errorResponse(
          res,
          400,
          "One or more provided reply-to users are invalid.",
        );
      }
    }

    const insertQuery = `
      INSERT INTO scheduler_email (
        company_id,
        builder_id,
        name,
        frequency,
        send_to_all_active_users,
        notification_recipient_users,
        reply_to_users,
        subject,
        message_body,
        no_of_action_days,
        no_record_message,
        no_record_message_body,
        attach_files,
        is_active,
        created_by,
        updated_by
      )
      VALUES (
        $1, $2, $3, $4, $5, $6::uuid[], $7::uuid[],
        $8, $9, $10, $11, $12, $13, $14, $15, $15
      )
      RETURNING *;
    `;

    const values = [
      companyId,
      builderId,
      name.trim(),
      frequency,
      send_to_all_active_users,
      notification_recipient_users || [],
      reply_to_users || [],
      subject.trim(),
      message_body.trim(),
      no_of_action_days || null,
      no_record_message,
      no_record_message_body || null,
      attach_files,
      is_active,
      userId,
    ];

    const result = await client.query(insertQuery, values);

    // Filter out sensitive fields from response
    const {
      company_id,
      builder_id,
      created_at,
      updated_at,
      created_by,
      updated_by,
      ...filtered
    } = result.rows[0];

    return successResponse(
      res,
      keysToCamelCase(filtered),
      "Scheduler email created successfully.",
    );
  } catch (error) {
    console.error("Error creating scheduler email:", error);
    return errorResponse(res, 500, "Internal server error.", error.message);
  } finally {
    client.release();
  }
};

exports.getAllSchedulerEmail = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const { page = 1, limit = 25, is_active } = req.query;

    const limitValue = parseInt(limit, 10);
    const pageValue = parseInt(page, 10);
    const offset = (pageValue - 1) * limitValue;

    let whereClause = `WHERE (se.builder_id = $1 OR se.company_id = $2)`;
    const params = [builderId, companyId, limitValue, offset];

    if (is_active !== undefined) {
      whereClause += ` AND se.is_active = $5`;
      params.push(is_active === "true");
    }

    const dataQuery = `
      SELECT 
        *
      FROM scheduler_email se
      ${whereClause}
      ORDER BY se.created_at DESC
      LIMIT $3 OFFSET $4;
    `;

    const dataResult = await client.query(dataQuery, params);

    // Filter out sensitive fields from response
    const filteredDataResult = dataResult.rows.map((row) => {
      const {
        company_id,
        builder_id,
        created_at,
        updated_at,
        created_by,
        updated_by,
        ...filtered
      } = row;
      return filtered;
    });

    let countParams = [builderId, companyId];
    let countWhere = `WHERE (builder_id = $1 OR company_id = $2)`;

    if (is_active !== undefined) {
      countWhere += ` AND is_active = $3`;
      countParams.push(is_active === "true");
    }

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM scheduler_email
      ${countWhere};
    `;

    const countResult = await client.query(countQuery, countParams);

    const totalRecords = parseInt(countResult.rows[0].total, 10);
    const totalPages = Math.ceil(totalRecords / limitValue);

    return successResponse(
      res,
      {
        schedulerEmails: keysToCamelCase(filteredDataResult),
        pagination: {
          currentPage: pageValue,
          totalPages,
          totalRecords,
          limit: limitValue,
        },
      },
      "Scheduler emails fetched successfully.",
    );
  } catch (error) {
    console.error("Error fetching scheduler emails:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.deleteSchedulerEmail = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const { scheduler_email_id } = req.params;

    const checkQuery = `
      SELECT scheduler_email_id
      FROM scheduler_email
      WHERE scheduler_email_id = $1
        AND (builder_id = $2 OR company_id = $3);
    `;
    const checkResult = await client.query(checkQuery, [
      scheduler_email_id,
      builderId,
      companyId,
    ]);

    if (checkResult.rows.length === 0) {
      return errorResponse(
        res,
        404,
        "Scheduler email not found or you are not authorized to delete this record.",
      );
    }

    const deleteQuery = `
      DELETE FROM scheduler_email
      WHERE scheduler_email_id = $1
        AND (builder_id = $2 OR company_id = $3);
    `;
    await client.query(deleteQuery, [scheduler_email_id, builderId, companyId]);

    return successResponse(res, null, "Scheduler email deleted successfully.");
  } catch (error) {
    console.error("Error deleting scheduler email:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.updateSchedulerEmail = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.users_id;
    const { scheduler_email_id } = req.params;

    let {
      name,
      frequency,
      send_to_all_active_users,
      notification_recipient_users,
      reply_to_users,
      exclude_recipients,
      subject,
      message_body,
      no_of_action_days,
      no_record_message,
      no_record_message_body,
    } = req.body;

    // Validate exclude_recipients field
    if (exclude_recipients !== undefined) {
      if (send_to_all_active_users === false) {
        return errorResponse(
          res,
          400,
          "exclude_recipients field can only be used when send_to_all_active_users is true",
        );
      }

      if (!Array.isArray(exclude_recipients)) {
        return errorResponse(
          res,
          400,
          "exclude_recipients must be an array of user IDs",
        );
      }
    }

    const attach_files = req.file?.location || req.body.attach_files || null;

    const checkQuery = `
      SELECT *
      FROM scheduler_email
      WHERE scheduler_email_id = $1
        AND ((builder_id IS NOT NULL AND builder_id = $2)
          OR (company_id IS NOT NULL AND company_id = $3))
          AND is_active = true
    `;
    const checkResult = await client.query(checkQuery, [
      scheduler_email_id,
      builderId,
      companyId,
    ]);

    if (checkResult.rows.length === 0) {
      return errorResponse(
        res,
        404,
        "Scheduler email not found or you are not authorized to update it.",
      );
    }

    const existing = checkResult.rows[0];

    if (
      !name &&
      !frequency &&
      send_to_all_active_users === undefined &&
      (!notification_recipient_users ||
        notification_recipient_users.length === 0) &&
      (!reply_to_users || reply_to_users.length === 0) &&
      !subject &&
      !message_body &&
      no_of_action_days === undefined &&
      no_record_message === undefined &&
      no_record_message_body === undefined &&
      attach_files === undefined
    ) {
      return errorResponse(
        res,
        400,
        "At least one field must be provided to update.",
      );
    }

    const duplicateQuery = `
      SELECT scheduler_email_id
      FROM scheduler_email
      WHERE name = $1
        AND ((builder_id IS NOT NULL AND builder_id = $2)
          OR (company_id IS NOT NULL AND company_id = $3))
        AND scheduler_email_id != $4
    `;
    const duplicateResult = await client.query(duplicateQuery, [
      name || "IMPOSSIBLE-NAME-CHECK",
      builderId,
      companyId,
      scheduler_email_id,
    ]);

    if (name && duplicateResult.rows.length > 0) {
      return errorResponse(
        res,
        400,
        "A scheduler email with this name already exists for this builder/company.",
      );
    }

    if (no_record_message === false && no_record_message_body) {
      return errorResponse(
        res,
        400,
        "Cannot provide 'no_record_message_body' when 'no_record_message' is false.",
      );
    }

    if (
      notification_recipient_users &&
      notification_recipient_users.length > 0
    ) {
      const checkNotificationUsersQuery = `
        SELECT users_id 
        FROM users
        WHERE users_id = ANY($1::uuid[]) AND is_deleted = false
      `;
      const validNotificationUsers = await client.query(
        checkNotificationUsersQuery,
        [notification_recipient_users],
      );

      if (
        validNotificationUsers.rows.length !==
        notification_recipient_users.length
      ) {
        return errorResponse(
          res,
          400,
          "One or more provided notification recipient users are invalid.",
        );
      }
    }

    if (reply_to_users && reply_to_users.length > 0) {
      const checkReplyToUsersQuery = `
        SELECT users_id 
        FROM users
        WHERE users_id = ANY($1::uuid[]) AND is_deleted = false
      `;
      const validReplyToUsers = await client.query(checkReplyToUsersQuery, [
        reply_to_users,
      ]);

      if (validReplyToUsers.rows.length !== reply_to_users.length) {
        return errorResponse(
          res,
          400,
          "One or more provided reply-to users are invalid.",
        );
      }
    }

    if (exclude_recipients && exclude_recipients.length > 0) {
      const checkReplyToUsersQuery = `
        SELECT users_id 
        FROM users
        WHERE users_id = ANY($1::uuid[]) AND is_deleted = false AND is_verified = true
      `;
      const validReplyToUsers = await client.query(checkReplyToUsersQuery, [
        exclude_recipients,
      ]);

      if (validReplyToUsers.rows.length !== exclude_recipients.length) {
        return errorResponse(
          res,
          400,
          "One or more provided exclude recipients are invalid.",
        );
      }
    }

    if (
      no_record_message === undefined &&
      no_record_message_body !== undefined
    ) {
      if (existing.no_record_message === false) {
        return errorResponse(
          res,
          400,
          "You cannot update 'no_record_message_body' when 'no_record_message' is false.",
        );
      }
    }

    if (no_record_message === false) {
      no_record_message_body = null;
    }

    // --- S3 Deletion Logic for attach_files ---
    let oldAttachFilesUrl = existing.attach_files;
    if (Object.prototype.hasOwnProperty.call(req.body, "attach_files")) {
      const newImage = req.body.attach_files || null;

      if (
        existing.attach_files && // If there is an existing image
        existing.attach_files !== newImage // AND the new image is different (including null)
      ) {
        await deleteFromS3(existing.attach_files);
      }
      oldAttachFilesUrl = newImage; // Update tracking variable for the return data
    }

    const updateQuery = `
      UPDATE scheduler_email
      SET
        name = COALESCE($1, name),
        frequency = COALESCE($2, frequency),
        send_to_all_active_users = COALESCE($3, send_to_all_active_users),
        notification_recipient_users = COALESCE($4::uuid[], notification_recipient_users),
        reply_to_users = COALESCE($5::uuid[], reply_to_users),
        exclude_recipients = COALESCE($6::uuid[], exclude_recipients),
        subject = COALESCE($7, subject),
        message_body = COALESCE($8, message_body),
        no_of_action_days = COALESCE($9, no_of_action_days),
        no_record_message = COALESCE($10, no_record_message),
        no_record_message_body = $11,
        attach_files = COALESCE($12, attach_files),
        updated_by = $13,
        updated_at = NOW()
      WHERE scheduler_email_id = $14
      RETURNING *;
    `;

    const updateValues = [
      name,
      frequency,
      send_to_all_active_users,
      notification_recipient_users,
      reply_to_users,
      exclude_recipients,
      subject,
      message_body,
      no_of_action_days,
      no_record_message,
      no_record_message_body,
      attach_files,
      userId,
      scheduler_email_id,
    ];

    const result = await client.query(updateQuery, updateValues);

    const {
      company_id,
      builder_id,
      created_at,
      updated_at,
      created_by,
      updated_by,
      ...filtered
    } = result.rows[0];

    return successResponse(
      res,
      keysToCamelCase(filtered),
      "Scheduler email updated successfully.",
    );
  } catch (error) {
    console.error("Error updating scheduler email:", error);
    return errorResponse(res, 500, "Internal server error.", error.message);
  } finally {
    client.release();
  }
};

exports.getSchedulerEmails = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.users_id;
    const { is_active } = req.query;

    // Define static 15 records template
    const staticRecords = [
      {
        name: "Daily Report Summary",
        frequency: "daily",
        subject: "Daily Report Summary",
        messageBody:
          "This is a daily report summary containing all project updates, task completions, and important notifications for today.",
        noOfActionDays: 1,
      },
      {
        name: "Weekly Progress Update",
        frequency: "weekly",
        subject: "Weekly Progress Update",
        messageBody:
          "Weekly progress update showing completed tasks, milestones achieved, and upcoming priorities for the week.",
        noOfActionDays: 7,
      },
      {
        name: "Monthly Performance Review",
        frequency: "monthly",
        subject: "Monthly Performance Review",
        messageBody:
          "Monthly performance review with detailed analytics, KPI tracking, and performance metrics for all projects.",
        noOfActionDays: 30,
      },
      {
        name: "Project Status Update",
        frequency: "daily",
        subject: "Project Status Update",
        messageBody:
          "Current project status including timeline, budget, resource allocation, and potential risks.",
        noOfActionDays: 1,
      },
      {
        name: "Team Notification",
        frequency: "daily",
        subject: "Team Notification",
        messageBody:
          "Team notifications including member updates, task assignments, and collaboration alerts.",
        noOfActionDays: 1,
      },
      {
        name: "Task Completion Report",
        frequency: "weekly",
        subject: "Task Completion Report",
        messageBody:
          "Weekly task completion report showing finished tasks, pending items, and completion rates.",
        noOfActionDays: 7,
      },
      {
        name: "Deadline Reminder",
        frequency: "daily",
        subject: "Deadline Reminder",
        messageBody:
          "Daily reminder for upcoming deadlines, task due dates, and critical project milestones.",
        noOfActionDays: 1,
      },
      {
        name: "Meeting Schedule",
        frequency: "weekly",
        subject: "Meeting Schedule",
        messageBody:
          "Weekly meeting schedule with agenda, participants, and action items from previous meetings.",
        noOfActionDays: 7,
      },
      {
        name: "Budget Overview",
        frequency: "monthly",
        subject: "Budget Overview",
        messageBody:
          "Monthly budget overview showing expenditures, remaining budget, and financial forecasts.",
        noOfActionDays: 30,
      },
      {
        name: "Resource Allocation",
        frequency: "weekly",
        subject: "Resource Allocation",
        messageBody:
          "Weekly resource allocation report showing team assignments, equipment usage, and availability.",
        noOfActionDays: 7,
      },
      {
        name: "Quality Check Report",
        frequency: "daily",
        subject: "Quality Check Report",
        messageBody:
          "Daily quality control report including inspections, compliance checks, and quality metrics.",
        noOfActionDays: 1,
      },
      {
        name: "Safety Inspection",
        frequency: "weekly",
        subject: "Safety Inspection",
        messageBody:
          "Weekly safety inspection report with hazard assessments, safety compliance, and incident reports.",
        noOfActionDays: 7,
      },
      {
        name: "Client Communication",
        frequency: "daily",
        subject: "Client Communication",
        messageBody:
          "Daily client communication summary including emails, meetings, and project updates shared with clients.",
        noOfActionDays: 1,
      },
      {
        name: "Vendor Update",
        frequency: "weekly",
        subject: "Vendor Update",
        messageBody:
          "Weekly vendor update showing supplier performance, deliveries, and procurement activities.",
        noOfActionDays: 7,
      },
      {
        name: "System Maintenance",
        frequency: "monthly",
        subject: "System Maintenance",
        messageBody:
          "Monthly system maintenance report including updates, backups, and technical performance metrics.",
        noOfActionDays: 30,
      },
    ];

    const countQuery = `
      SELECT 
        COUNT(*) as total_count,
        COUNT(CASE WHEN is_active = true THEN 1 END) as active_count,
        COUNT(CASE WHEN is_active = false THEN 1 END) as inactive_count
      FROM scheduler_email
      WHERE (company_id = $1 OR builder_id = $2)
    `;
    const countResult = await client.query(countQuery, [companyId, builderId]);
    const counts = countResult.rows[0];

    const existingRecordsQuery = `
      SELECT scheduler_email_id
      FROM scheduler_email
      WHERE (company_id = $1 OR builder_id = $2)
    `;
    const existingRecordsResult = await client.query(existingRecordsQuery, [
      companyId,
      builderId,
    ]);

    if (existingRecordsResult.rowCount === 0) {
      const insertQuery = `
        INSERT INTO scheduler_email (
          company_id, builder_id, name, frequency, send_to_all_active_users,
          notification_recipient_users, reply_to_users, exclude_recipients, subject, message_body,
          no_of_action_days, no_record_message, no_record_message_body,
          attach_files, is_active, created_by, updated_by
        ) VALUES 
        ${staticRecords
          .map(
            (_, index) =>
              `($${index * 17 + 1}, $${index * 17 + 2}, $${index * 17 + 3}, $${index * 17 + 4}, $${index * 17 + 5}, $${index * 17 + 6}, $${index * 17 + 7}, $${index * 17 + 8}, $${index * 17 + 9}, $${index * 17 + 10}, $${index * 17 + 11}, $${index * 17 + 12}, $${index * 17 + 13}, $${index * 17 + 14}, $${index * 17 + 15}, $${index * 17 + 16}, $${index * 17 + 17})`,
          )
          .join(", ")}
        RETURNING *;
      `;

      const insertValues = [];
      staticRecords.forEach((record) => {
        insertValues.push(
          companyId,
          builderId,
          record.name,
          record.frequency,
          true,
          [],
          [],
          [], // exclude_recipients
          record.subject,
          record.messageBody,
          record.noOfActionDays,
          false,
          null,
          null, // attach_files
          true,
          userId,
          userId,
        );
      });

      const insertResult = await client.query(insertQuery, insertValues);

      // Filter out sensitive fields from response
      const filteredResults = insertResult.rows.map((row) => {
        const {
          company_id,
          builder_id,
          created_at,
          updated_at,
          created_by,
          updated_by,
          ...filtered
        } = row;
        return filtered;
      });

      return successResponse(
        res,
        {
          scheduler_emails: keysToCamelCase(filteredResults),
          counts: {
            total: parseInt(counts.total_count),
            active: parseInt(counts.active_count),
            inactive: parseInt(counts.inactive_count),
          },
        },
        "15 default scheduler emails created and fetched successfully.",
      );
    } else {
      const query = `
        SELECT *
        FROM scheduler_email
        WHERE (company_id = $1 OR builder_id = $2)
        ${is_active !== undefined ? "AND is_active = $3" : ""}
        ORDER BY created_at ASC
        LIMIT 15
      `;

      const queryParams = [companyId, builderId];
      if (is_active !== undefined) {
        queryParams.push(is_active === "true");
      }
      const result = await client.query(query, queryParams);

      // Filter out sensitive fields from response
      const filteredResults = result.rows.map((row) => {
        const {
          company_id,
          builder_id,
          created_at,
          updated_at,
          created_by,
          updated_by,
          ...filtered
        } = row;
        return filtered;
      });

      return successResponse(
        res,
        {
          scheduler_emails: keysToCamelCase(filteredResults),
          counts: {
            total: parseInt(counts.total_count),
            active: parseInt(counts.active_count),
            inactive: parseInt(counts.inactive_count),
          },
        },
        "Scheduler emails fetched successfully.",
      );
    }
  } catch (error) {
    console.error("Error fetching scheduler emails:", error);
    return errorResponse(res, 500, "Internal server error.", error.message);
  } finally {
    client.release();
  }
};

exports.toggleSchedulerEmailStatus = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.users_id;
    const { scheduler_email_id } = req.params;

    const checkQuery = `
      SELECT *
      FROM scheduler_email
      WHERE scheduler_email_id = $1
        AND ((builder_id IS NOT NULL AND builder_id = $2)
          OR (company_id IS NOT NULL AND company_id = $3))
    `;
    const checkResult = await client.query(checkQuery, [
      scheduler_email_id,
      builderId,
      companyId,
    ]);

    if (checkResult.rows.length === 0) {
      return errorResponse(
        res,
        404,
        "Scheduler email not found or you are not authorized to update it.",
      );
    }

    const currentStatus = checkResult.rows[0].is_active;
    const newStatus = !currentStatus;

    const updateQuery = `
      UPDATE scheduler_email
      SET 
        is_active = $1,
        updated_by = $2,
        updated_at = NOW()
      WHERE scheduler_email_id = $3
      RETURNING *;
    `;

    const result = await client.query(updateQuery, [
      newStatus,
      userId,
      scheduler_email_id,
    ]);

    const {
      company_id,
      builder_id,
      created_at,
      updated_at,
      created_by,
      updated_by,
      ...filtered
    } = result.rows[0];

    return successResponse(
      res,
      keysToCamelCase(filtered),
      `Scheduler email ${newStatus ? "activated" : "deactivated"} successfully.`,
    );
  } catch (error) {
    console.error("Error toggling scheduler email status:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
};
