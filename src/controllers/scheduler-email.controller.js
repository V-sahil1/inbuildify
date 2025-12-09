const getPool = require("../config/database");
const { errorResponse, successResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

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
      attach_files,
      is_active,
    } = req.body;

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
        "A scheduler email with this name already exists for this builder/company."
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
        [notification_recipient_users]
      );

      if (
        validNotificationUsers.rows.length !==
        notification_recipient_users.length
      ) {
        return errorResponse(
          res,
          400,
          "One or more provided notification recipient users are invalid."
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
          "One or more provided reply-to users are invalid."
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

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Scheduler email created successfully."
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
        schedulerEmails: keysToCamelCase(dataResult.rows),
        pagination: {
          currentPage: pageValue,
          totalPages,
          totalRecords,
          limit: limitValue,
        },
      },
      "Scheduler emails fetched successfully."
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
        "Scheduler email not found or you are not authorized to delete this record."
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
      subject,
      message_body,
      no_of_action_days,
      no_record_message,
      no_record_message_body,
      attach_files,
      is_active,
    } = req.body;

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
        "Scheduler email not found or you are not authorized to update it."
      );
    }

    const existing = checkResult.rows[0];
    const currentIsActive = existing.is_active;

    const updatingOtherFields =
      name !== undefined ||
      frequency !== undefined ||
      send_to_all_active_users !== undefined ||
      (notification_recipient_users &&
        notification_recipient_users.length > 0) ||
      (reply_to_users && reply_to_users.length > 0) ||
      subject !== undefined ||
      message_body !== undefined ||
      no_of_action_days !== undefined ||
      no_record_message !== undefined ||
      no_record_message_body !== undefined ||
      attach_files !== undefined;

    const requestedIsActiveTrue = is_active === true || is_active === "true";
    const requestedIsActiveFalse = is_active === false || is_active === "false";

    if (currentIsActive === true && is_active !== undefined) {
      if (requestedIsActiveFalse) {
        if (updatingOtherFields) {
          return errorResponse(
            res,
            403,
            "To deactivate an active scheduler email, 'is_active' must be the only field provided in the request."
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
            "To activate an inactive scheduler email, 'is_active' must be the only field provided in the request."
          );
        }
      }

      if (updatingOtherFields) {
        if (is_active === undefined || requestedIsActiveFalse) {
          return errorResponse(
            res,
            403,
            "Cannot update non-'is_active' fields when the scheduler email is currently inactive. Only 'is_active' can be changed (to true)."
          );
        }
      }

      if (is_active !== undefined) {
        if (requestedIsActiveFalse) {
          return errorResponse(
            res,
            403,
            "Scheduler email is already inactive. 'is_active' can only be updated to true from this state."
          );
        }
      }
    }

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
      attach_files === undefined &&
      is_active === undefined
    ) {
      return errorResponse(
        res,
        400,
        "At least one field must be provided to update."
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
        "A scheduler email with this name already exists for this builder/company."
      );
    }

    if (no_record_message === false && no_record_message_body) {
      return errorResponse(
        res,
        400,
        "Cannot provide 'no_record_message_body' when 'no_record_message' is false."
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
        [notification_recipient_users]
      );

      if (
        validNotificationUsers.rows.length !==
        notification_recipient_users.length
      ) {
        return errorResponse(
          res,
          400,
          "One or more provided notification recipient users are invalid."
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
          "One or more provided reply-to users are invalid."
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
          "You cannot update 'no_record_message_body' when 'no_record_message' is false."
        );
      }
    }

    if (no_record_message === false) {
      no_record_message_body = null;
    }
    const updateQuery = `
      UPDATE scheduler_email
      SET
        name = COALESCE($1, name),
        frequency = COALESCE($2, frequency),
        send_to_all_active_users = COALESCE($3, send_to_all_active_users),
        notification_recipient_users = COALESCE($4::uuid[], notification_recipient_users),
        reply_to_users = COALESCE($5::uuid[], reply_to_users),
        subject = COALESCE($6, subject),
        message_body = COALESCE($7, message_body),
        no_of_action_days = COALESCE($8, no_of_action_days),
        no_record_message = COALESCE($9, no_record_message),
        no_record_message_body = $10,
        attach_files = COALESCE($11, attach_files),
        is_active = COALESCE($12, is_active),
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
      subject,
      message_body,
      no_of_action_days,
      no_record_message,
      no_record_message_body,
      attach_files,
      is_active,
      userId,
      scheduler_email_id,
    ];

    const result = await client.query(updateQuery, updateValues);

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Scheduler email updated successfully."
    );
  } catch (error) {
    console.error("Error updating scheduler email:", error);
    return errorResponse(res, 500, "Internal server error.", error.message);
  } finally {
    client.release();
  }
};
