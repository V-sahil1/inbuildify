import getPool from "../../config/database.js";
import { successResponse, errorResponse } from "../../helper/response.js";
import { keysToCamelCase } from "../../utils/common.js";
import { deleteFromS3 } from "../../utils/s3Upload.js";
import { logActivity, compareAndLogUpdates } from "../../utils/activityLogger.js";
import db from "../../config/database/models/postgre-models/index.js";
import { QueryTypes } from "sequelize";
import { checkLeadLockStatus } from "../../helper/leadLock.helper.js";

export async function createTask(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const createdBy = req.user?.user_id;

    const {
      name,
      description,
      due_date,
      due_time,
      assignee_id,
      link_to,
      link_type,
      lead_id,
      priority = "Medium",
      status = "Yet to Start",
    } = req.body;

    const attach_files = req.files?.attachFiles?.[0]?.location || null;

    if (!builderId || !companyId) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "Invalid builder or company");
    }

    if (assignee_id) {
      const assigneeCheck = await client.query(
        "SELECT users_id FROM users WHERE users_id = $1 AND is_deleted = false AND is_verified = true",
        [assignee_id],
      );

      if (assigneeCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Invalid assignee_id");
      }
    }

    if (link_to) {
      const linkToCheck = await client.query(
        "SELECT users_id FROM users WHERE users_id = $1 AND is_deleted = false AND is_verified = true",
        [link_to],
      );

      if (linkToCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Invalid link_to user_id");
      }
    }

    if (lead_id) {
      const leadCheck = await client.query(
        "SELECT leads_id FROM leads WHERE leads_id = $1 AND (company_id = $2 OR builder_id = $3)",
        [lead_id, companyId, builderId],
      );

      if (leadCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "Invalid lead_id. Lead not found for this builder/company.",
        );
      }

      await checkLeadLockStatus(lead_id);
    }

    function isValidDate(dateString) {
      const date = new Date(dateString);
      return (
        !isNaN(date.getTime()) && date.toISOString().slice(0, 10) === dateString
      );
    }

    if (due_date && !isValidDate(due_date)) {
      return errorResponse(res, 400, `Invalid date: ${due_date}`);
    }

    const insertQuery = `
      INSERT INTO task (
        company_id,
        builder_id,
        name,
        description,
        due_date,
        due_time,
        assignee_id,
        link_to,
        link_type,
        lead_id,
        priority,
        status,
        attach_files,
        created_by,
        updated_by
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      RETURNING *
    `;

    const result = await client.query(insertQuery, [
      companyId,
      builderId,
      name,
      description || null,
      due_date || null,
      due_time || null,
      assignee_id || null,
      link_to || null,
      link_type || null,
      lead_id || null,
      priority,
      status,
      attach_files,
      createdBy,
      createdBy,
    ]);

    await client.query("COMMIT");

    let assigneeName = null;
    if (assignee_id) {
      const assigneeResult = await client.query(
        "SELECT name as assignee_name FROM users WHERE users_id = $1",
        [assignee_id],
      );
      if (assigneeResult.rowCount > 0) {
        assigneeName = assigneeResult.rows[0].assignee_name;
      }
    }

    const creatorResult = await client.query(
      "SELECT name FROM users WHERE users_id = $1",
      [result.rows[0].created_by],
    );

    const transformed = keysToCamelCase(result.rows[0]);

    transformed.assigneeName = assigneeName;
    transformed.createdbyname = creatorResult.rows[0]?.name || null;
    transformed.linkTo = link_to;
    transformed.linkType = link_type;

    const orderedTask = {};
    const fieldOrder = [
      "taskId",
      "companyId",
      "builderId",
      "name",
      "description",
      "dueDate",
      "dueTime",
      "assigneeId",
      "assigneeName",
      "linkTo",
      "linkType",
      "leadId",
      "priority",
      "status",
      "isDeleted",
      "attachFiles",
      "createdBy",
      "createdbyname",
      "updatedBy",
      "createdAt",
      "updatedAt",
    ];

    fieldOrder.forEach((field) => {
      if (transformed.hasOwnProperty(field)) {
        orderedTask[field] = transformed[field];
      }
    });

    if (lead_id) {
       await logActivity(client, {
        userId: createdBy,
        leadsId: lead_id,
        module: "Task",
        moduleId: result.rows[0].task_id,
        recordName: name,
        action: "CREATE",
        description: `Task created: ${name}`
      });
    }

    return successResponse(res, orderedTask, "Task created successfully.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error creating task:", err);
    return errorResponse(res, err.status || 500, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
}

export async function getAllTasks(req, res) {
  try {
    const builderId = req.user?.builder_id;

    if (!builderId) {
      return errorResponse(res, 400, "Builder ID missing from token");
    }

    const {
      page = 1,
      limit = 25,
      name,
      due_date,
      status,
      priority,
      assignee_id,
      link_to,
      link_type,
      lead_id,
      date_filter,
      is_deleted,
      sort_by = "created_at",
      sort_order = "DESC",
    } = req.query;

    const pageValue = parseInt(page, 10);
    const limitValue = parseInt(limit, 10);
    const offset = (pageValue - 1) * limitValue;

    // Whitelist sort params to prevent SQL injection
    const validSortFields = ["name", "due_date", "priority", "status", "created_at"];
    const validSortOrders = ["ASC", "DESC"];
    const safeSortBy = validSortFields.includes(sort_by) ? sort_by : "created_at";
    const safeSortOrder = validSortOrders.includes(sort_order?.toUpperCase()) ? sort_order.toUpperCase() : "DESC";

    const conditions = ["t.builder_id = :builderId"];
    const replacements = { builderId };

    if (name) {
      conditions.push("LOWER(t.name) LIKE LOWER(:name)");
      replacements.name = `%${name}%`;
    }
    if (due_date) {
      conditions.push("t.due_date = :dueDate");
      replacements.dueDate = due_date;
    }
    if (status) {
      conditions.push("t.status = :status");
      replacements.status = status;
    }
    if (priority) {
      conditions.push("t.priority = :priority");
      replacements.priority = priority;
    }
    if (assignee_id) {
      const assigneeIds = (Array.isArray(assignee_id) ? assignee_id : [assignee_id])
        .flatMap((value) => String(value).split(","))
        .map((id) => id.trim())
        .filter(Boolean);
      if (assigneeIds.length > 0) {
        conditions.push("t.assignee_id IN (:assigneeIds)");
        replacements.assigneeIds = assigneeIds;
      }
    }
    if (link_to) {
      conditions.push("t.link_to = :linkTo");
      replacements.linkTo = link_to;
    }
    if (link_type) {
      conditions.push("t.link_type = :linkType");
      replacements.linkType = link_type;
    }
    if (lead_id) {
      conditions.push("t.lead_id = :leadId");
      replacements.leadId = lead_id;
    }

    if (is_deleted === "true" || is_deleted === true) {
      // Show all records (deleted and non-deleted)
    } else {
      conditions.push("t.is_deleted = false");
    }

    if (date_filter) {
      switch (date_filter) {
        case "today":
          conditions.push("t.due_date = CURRENT_DATE");
          conditions.push("t.status NOT IN ('Completed','Cancelled','Skipped')");
          break;
        case "tomorrow":
          conditions.push("t.due_date = CURRENT_DATE + INTERVAL '1 day'");
          conditions.push("t.status NOT IN ('Completed','Cancelled','Skipped')");
          break;
        case "this_week":
          conditions.push("t.due_date BETWEEN date_trunc('week', CURRENT_DATE) AND date_trunc('week', CURRENT_DATE) + INTERVAL '6 days'");
          conditions.push("t.status NOT IN ('Completed','Cancelled','Skipped')");
          break;
        case "next_week":
          conditions.push("t.due_date BETWEEN date_trunc('week', CURRENT_DATE) + INTERVAL '7 days' AND date_trunc('week', CURRENT_DATE) + INTERVAL '13 days'");
          conditions.push("t.status NOT IN ('Completed','Cancelled','Skipped')");
          break;
        case "overdue":
          conditions.push("t.due_date < CURRENT_DATE");
          conditions.push("t.status NOT IN ('Completed','Cancelled','Skipped')");
          break;
        case "pending":
          conditions.push("t.status IN ('Yet to Start','In Progress')");
          break;
      }
    }

    const whereClause = `WHERE ${conditions.join(" AND ")}`;
    const { sequelize } = db;

    const counterRows = await sequelize.query(
      `SELECT
        COUNT(*) AS all_count,
        COUNT(*) FILTER (WHERE t.due_date = CURRENT_DATE AND t.status NOT IN ('Completed','Cancelled','Skipped')) AS today_count,
        COUNT(*) FILTER (WHERE t.due_date = CURRENT_DATE + INTERVAL '1 day' AND t.status NOT IN ('Completed','Cancelled','Skipped')) AS tomorrow_count,
        COUNT(*) FILTER (WHERE t.due_date BETWEEN date_trunc('week', CURRENT_DATE) AND date_trunc('week', CURRENT_DATE) + INTERVAL '6 days' AND t.status NOT IN ('Completed','Cancelled','Skipped')) AS this_week_count,
        COUNT(*) FILTER (WHERE t.due_date BETWEEN date_trunc('week', CURRENT_DATE) + INTERVAL '7 days' AND date_trunc('week', CURRENT_DATE) + INTERVAL '13 days' AND t.status NOT IN ('Completed','Cancelled','Skipped')) AS next_week_count,
        COUNT(*) FILTER (WHERE t.due_date < CURRENT_DATE AND t.status NOT IN ('Completed','Cancelled','Skipped')) AS overdue_count,
        COUNT(*) FILTER (WHERE t.status IN ('Yet to Start','In Progress')) AS pending_count
       FROM task t
       WHERE t.builder_id = :builderId AND t.is_deleted = false`,
      { type: QueryTypes.SELECT, replacements: { builderId } }
    );

    const counters = {
      allCount: Number(counterRows[0]?.all_count) || 0,
      todayCount: Number(counterRows[0]?.today_count) || 0,
      tomorrowCount: Number(counterRows[0]?.tomorrow_count) || 0,
      thisWeekCount: Number(counterRows[0]?.this_week_count) || 0,
      nextWeekCount: Number(counterRows[0]?.next_week_count) || 0,
      overdueCount: Number(counterRows[0]?.overdue_count) || 0,
      pendingCount: Number(counterRows[0]?.pending_count) || 0,
    };

    const countRows = await sequelize.query(
      `SELECT COUNT(*) AS total FROM task t ${whereClause}`,
      { type: QueryTypes.SELECT, replacements }
    );
    const totalRecords = parseInt(countRows[0]?.total, 10) || 0;
    const totalPages = Math.ceil(totalRecords / limitValue);

    const dataRows = await sequelize.query(
      `SELECT t.*,
              u.name AS assignee_name,
              (SELECT name FROM users WHERE users_id = t.created_by) AS createdbyname
       FROM task t
       LEFT JOIN users u ON t.assignee_id = u.users_id
       ${whereClause}
       ORDER BY t.${safeSortBy} ${safeSortOrder}
       LIMIT ${limitValue} OFFSET ${offset}`,
      { type: QueryTypes.SELECT, replacements }
    );

    const transformedTasks = keysToCamelCase(dataRows).map((task) => {
      const orderedTask = {};
      const fieldOrder = [
        "taskId", "companyId", "builderId", "name", "description",
        "dueDate", "dueTime", "assigneeId", "assigneeName",
        "linkTo", "linkType", "leadId", "priority", "status", "isDeleted",
        "attachFiles", "createdBy", "createdbyname", "updatedBy",
        "createdAt", "updatedAt",
      ];
      fieldOrder.forEach((field) => {
        if (task.hasOwnProperty(field)) {
          orderedTask[field] = task[field];
        }
      });
      return orderedTask;
    });

    return successResponse(
      res,
      {
        tasks: transformedTasks,
        pagination: { currentPage: pageValue, totalPages, totalRecords, limit: limitValue },
        counters,
      },
      "Tasks fetched successfully",
    );
  } catch (error) {
    console.error("Error in getAllTasks:", error);
    return errorResponse(res, error.status || 500, error.message || "Internal server error");
  }
}

export async function deleteTask(req, res) {
  const { task_id } = req.params;
  const builderId = req.user?.builder_id;
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const checkQuery = `
      SELECT *
      FROM task
      WHERE task_id = $1
    `;

    const checkResult = await client.query(checkQuery, [task_id]);

    if (checkResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Task not found");
    }

    const task = checkResult.rows[0];

    if (task.builder_id !== builderId) {
      await client.query("ROLLBACK");

      return errorResponse(
        res,
        403,
        "You cannot delete tasks of another builder",
      );
    }

    await checkLeadLockStatus(task.lead_id);

    if (task.is_deleted) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "Task is already deleted.");
    }

    const deleteQuery = `
      UPDATE task
      SET 
        is_deleted = TRUE,
        updated_at = NOW(),
        updated_by = $2
      WHERE task_id = $1
      RETURNING *;
    `;

    const result = await client.query(deleteQuery, [task_id, req.user?.users_id]);
    
    const taskData = keysToCamelCase(result.rows[0]);

    // Get assignee name
    let assigneeName = null;
    if (taskData.assigneeId) {
      const assigneeResult = await client.query(
        "SELECT name as assignee_name FROM users WHERE users_id = $1",
        [taskData.assigneeId],
      );
      if (assigneeResult.rowCount > 0) {
        assigneeName = assigneeResult.rows[0].assignee_name;
      }
    }

    // Get creator name
    const creatorResult = await client.query(
      "SELECT name FROM users WHERE users_id = $1",
      [result.rows[0].created_by]
    );

    const transformed = keysToCamelCase(result.rows[0]);
    transformed.assigneeName = assigneeName;
    transformed.createdbyname = creatorResult.rows[0]?.name || null;

    const orderedTask = {};
    const fieldOrder = [
      "taskId", "companyId", "builderId", "name", "description",
      "dueDate", "dueTime", "assigneeId", "assigneeName",
      "linkTo", "linkType", "leadId", "priority", "status", "isDeleted",
      "attachFiles", "createdBy", "createdbyname", "updatedBy",
      "createdAt", "updatedAt",
    ];

    fieldOrder.forEach((field) => {
      if (transformed.hasOwnProperty(field)) {
        orderedTask[field] = transformed[field];
      }
    });

    // Log Activity
    if (task.lead_id) {
      await logActivity(client, {
        userId: req.user?.users_id,
        leadsId: task.lead_id,
        module: "Task",
        moduleId: task_id,
        recordName: task.name,
        action: "DELETE",
        description: `Task deleted: ${task.name}`
      });
    }

    await client.query("COMMIT");
    return successResponse(res, orderedTask, "Task deleted successfully");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error deleting task:", error);
    return errorResponse(res, error.status || 500, error.message || "Internal server error");
  } finally {
    client.release();
  }
}

export async function updateTask(req, res) {
  const { task_id } = req.params;
  const builderId = req.user?.builder_id;
  const userId = req.user?.user_id;

  const {
    name,
    description,
    due_date,
    due_time,
    assignee_id,
    link_to,
    link_type,
    priority,
    status,
  } = req.body;

  const attach_files =
    req.files?.attachFiles?.[0]?.location || req.body.attach_files;

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const findQuery = `
      SELECT * FROM task 
      WHERE task_id = $1 AND builder_id = $2 AND is_deleted = false
    `;

    const findResult = await client.query(findQuery, [task_id, builderId]);

    if (findResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return errorResponse(
        res,
        404,
        "Task not found or you do not have permission to update it",
      );
    }

    await checkLeadLockStatus(findResult.rows[0].lead_id);

    function isValidDate(dateString) {
      const date = new Date(dateString);

      return (
        !isNaN(date.getTime()) && date.toISOString().slice(0, 10) === dateString
      );
    }

    if (due_date && !isValidDate(due_date)) {
      return errorResponse(res, 400, `Invalid date: ${due_date}`);
    }

    const fields = [];
    const values = [];

    let index = 1;

    if (name) {
      fields.push(`name = $${index}`);
      values.push(name);
      index++;
    }

    if (description) {
      fields.push(`description = $${index}`);
      values.push(description);
      index++;
    }

    if (due_date) {
      fields.push(`due_date = $${index}`);
      values.push(due_date);
      index++;
    }

    if (due_time) {
      fields.push(`due_time = $${index}`);
      values.push(due_time);
      index++;
    }

    if (priority) {
      fields.push(`priority = $${index}`);
      values.push(priority);
      index++;
    }

    if (status) {
      fields.push(`status = $${index}`);
      values.push(status);
      index++;
    }

    if (assignee_id) {
      const assigneeCheck = await client.query(
        "SELECT users_id FROM users WHERE users_id = $1 AND is_deleted = false AND is_verified = true",
        [assignee_id],
      );

      if (assigneeCheck.rows.length === 0) {
        await client.query("ROLLBACK");

        return errorResponse(
          res,
          400,
          "Invalid assignee_id. You can assign only your own builder users",
        );
      }

      fields.push(`assignee_id = $${index}`);
      values.push(assignee_id);
      index++;
    }

    if (link_to) {
      const linkToCheck = await client.query(
        "SELECT users_id FROM users WHERE users_id = $1 AND is_deleted = false AND is_verified = true",
        [link_to],
      );

      if (linkToCheck.rows.length === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Invalid link_to user_id");
      }

      fields.push(`link_to = $${index}`);
      values.push(link_to);
      index++;
    }

    if (link_type !== undefined) {
      fields.push(`link_type = $${index}`);
      values.push(link_type);
      index++;
    }

    if (attach_files !== undefined || req.files?.attachFiles) {
      const existingTask = findResult.rows[0];

      const newAttachFiles =
        req.files?.attachFiles?.[0]?.location || attach_files;

      if (
        newAttachFiles &&
        existingTask.attach_files &&
        newAttachFiles !== existingTask.attach_files
      ) {
        try {
          await deleteFromS3(existingTask.attach_files);
        } catch (s3Error) {
          console.error("Error deleting old attachment from S3:", s3Error);
        }
      }

      if (attach_files === "" || attach_files === null) {
        if (existingTask.attach_files) {
          try {
            await deleteFromS3(existingTask.attach_files);
          } catch (s3Error) {
            console.error("Error deleting old attachment from S3:", s3Error);
          }
        }

        fields.push(`attach_files = $${index}`);
        values.push(null);
        index++;
      } else if (newAttachFiles) {
        fields.push(`attach_files = $${index}`);
        values.push(newAttachFiles);
        index++;
      }
    }

    if (fields.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "No fields to update");
    }

    fields.push("updated_at = NOW()");
    fields.push(`updated_by = $${index}`);
    values.push(userId);
    index++;
    values.push(task_id);

    const updateQuery = `
      UPDATE task
      SET ${fields.join(", ")}
      WHERE task_id = $${index}
      RETURNING *
    `;
    const updateResult = await client.query(updateQuery, values);
    await client.query("COMMIT");

    // Log Activity
    if (findResult.rows[0].lead_id) {
      await compareAndLogUpdates(client, {
        userId: userId,
        leadsId: findResult.rows[0].lead_id,
        module: "Task",
        moduleId: task_id,
        recordName: updateResult.rows[0].name,
        oldData: keysToCamelCase(findResult.rows[0]),
        newData: keysToCamelCase(updateResult.rows[0])
      });
    }

    const updatedTask = updateResult.rows[0];
    let assigneeName = null;
    if (updatedTask.assignee_id) {
      const assigneeResult = await client.query(
        "SELECT name as assignee_name FROM users WHERE users_id = $1",
        [updatedTask.assignee_id],
      );
      if (assigneeResult.rowCount > 0) {
        assigneeName = assigneeResult.rows[0].assignee_name;
      }
    }

    const creatorResult = await client.query(
      "SELECT name FROM users WHERE users_id = $1",
      [updatedTask.created_by],
    );

    const transformed = keysToCamelCase(updateResult.rows[0]);

    transformed.assigneeName = assigneeName;
    transformed.createdbyname = creatorResult.rows[0]?.name || null;
    transformed.linkTo = transformed.linkTo || link_to;
    transformed.linkType = transformed.linkType || link_type;

    const orderedTask = {};
    const fieldOrder = [
      "taskId",
      "companyId",
      "builderId",
      "name",
      "description",
      "dueDate",
      "dueTime",
      "assigneeId",
      "assigneeName",
      "linkTo",
      "linkType",
      "leadId",
      "priority",
      "status",
      "isDeleted",
      "attachFiles",
      "createdBy",
      "createdbyname",
      "updatedBy",
      "createdAt",
      "updatedAt",
    ];

    fieldOrder.forEach((field) => {
      if (transformed.hasOwnProperty(field)) {
        orderedTask[field] = transformed[field];
      }
    });

    return successResponse(res, orderedTask, "Task updated successfully");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error updating task:", error);
    return errorResponse(res, error.status || 500, error.message || "Internal server error");
  } finally {
    client.release();
  }
}
