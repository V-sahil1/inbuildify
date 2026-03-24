import getPool from "../../config/database.js";
import { successResponse, errorResponse } from "../../helper/response.js";
import { keysToCamelCase } from "../../utils/common.js";
import { deleteFromS3 } from "../../utils/s3Upload.js";

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
        priority,
        status,
        attach_files,
        created_by,
        updated_by
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
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

    const transformed = keysToCamelCase(result.rows[0]);

    transformed.assigneeName = assigneeName;
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
      "priority",
      "status",
      "attachFiles",
      "createdBy",
      "updatedBy",
      "createdAt",
      "updatedAt",
    ];

    fieldOrder.forEach((field) => {
      if (transformed.hasOwnProperty(field)) {
        orderedTask[field] = transformed[field];
      }
    });

    return successResponse(res, orderedTask, "Task created successfully.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error creating task:", err);
    return errorResponse(res, 500, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
}

export async function getAllTasks(req, res) {
  const pool = getPool();
  const client = await pool.connect();

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
    } = req.query;

    const pageValue = parseInt(page, 10);
    const limitValue = parseInt(limit, 10);
    const offset = (pageValue - 1) * limitValue;
    const filters = [];
    const values = [];

    let index = 1;

    filters.push(`t.builder_id = $${index}`);
    values.push(builderId);
    index++;

    if (name) {
      filters.push(`LOWER(t.name) LIKE LOWER($${index})`);
      values.push(`%${name}%`);
      index++;
    }

    if (due_date) {
      filters.push(`t.due_date = $${index}`);
      values.push(due_date);
      index++;
    }

    if (status) {
      filters.push(`t.status = $${index}`);
      values.push(status);
      index++;
    }

    if (priority) {
      filters.push(`t.priority = $${index}`);
      values.push(priority);
      index++;
    }

    if (assignee_id) {
      filters.push(`t.assignee_id = $${index}`);
      values.push(assignee_id);
      index++;
    }

    if (link_to) {
      filters.push(`t.link_to = $${index}`);
      values.push(link_to);
      index++;
    }

    if (link_type) {
      filters.push(`t.link_type = $${index}`);
      values.push(link_type);
      index++;
    }

    const whereClause =
      filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";

    const counterQuery = `
    SELECT
      COUNT(*) FILTER (
        WHERE t.due_date = CURRENT_DATE
        AND t.status NOT IN ('Completed','Cancelled','Skipped')
      ) AS today_count,

      COUNT(*) FILTER (
        WHERE t.due_date = CURRENT_DATE + INTERVAL '1 day'
        AND t.status NOT IN ('Completed','Cancelled','Skipped')
      ) AS tomorrow_count,

      COUNT(*) FILTER (
        WHERE t.due_date BETWEEN
          date_trunc('week', CURRENT_DATE)
          AND date_trunc('week', CURRENT_DATE) + INTERVAL '6 days'
        AND t.status NOT IN ('Completed','Cancelled','Skipped')
      ) AS this_week_count,

      COUNT(*) FILTER (
        WHERE t.due_date BETWEEN
          date_trunc('week', CURRENT_DATE) + INTERVAL '7 days'
          AND date_trunc('week', CURRENT_DATE) + INTERVAL '13 days'
        AND t.status NOT IN ('Completed','Cancelled','Skipped')
      ) AS next_week_count,

      COUNT(*) FILTER (
        WHERE t.due_date < CURRENT_DATE
        AND t.status NOT IN ('Completed','Cancelled','Skipped')
      ) AS overdue_count,

      COUNT(*) FILTER (
        WHERE t.status IN ('Yet to Start','In Progress')
      ) AS pending_count

    FROM task t
    WHERE t.builder_id = $1
  `;

    const counterResult = await client.query(counterQuery, [builderId]);
    const counters = {
      todayCount: Number(counterResult.rows[0].today_count) || 0,
      tomorrowCount: Number(counterResult.rows[0].tomorrow_count) || 0,
      thisWeekCount: Number(counterResult.rows[0].this_week_count) || 0,
      nextWeekCount: Number(counterResult.rows[0].next_week_count) || 0,
      overdueCount: Number(counterResult.rows[0].overdue_count) || 0,
      pendingCount: Number(counterResult.rows[0].pending_count) || 0,
    };

    const countQuery = `
        SELECT COUNT(*) AS total
        FROM task t
        ${whereClause}
      `;

    const countResult = await client.query(countQuery, values);
    const totalRecords = parseInt(countResult.rows[0].total, 10);
    const totalPages = Math.ceil(totalRecords / limitValue);
    const dataQuery = `

        SELECT t.*,
              u.name as assignee_name
        FROM task t
        LEFT JOIN users u ON t.assignee_id = u.users_id
        ${whereClause}
        ORDER BY t.created_at DESC
        LIMIT ${limitValue}
        OFFSET ${offset}

      `;

    const dataResult = await client.query(dataQuery, values);

    const transformedTasks = keysToCamelCase(dataResult.rows).map((task) => {
      const transformed = {
        ...task,
        assigneeName: task.assigneeName,
        linkTo: task.linkTo,
        linkType: task.linkType,
      };

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
        "priority",
        "status",
        "attachFiles",
        "createdBy",
        "updatedBy",
        "createdAt",
        "updatedAt",
      ];

      fieldOrder.forEach((field) => {
        if (transformed.hasOwnProperty(field)) {
          orderedTask[field] = transformed[field];
        }
      });

      return orderedTask;
    });

    return successResponse(
      res,
      {
        tasks: transformedTasks,
        pagination: {
          currentPage: pageValue,
          totalPages,
          totalRecords,
          limit: limitValue,
        },
        counters,
      },
      "Tasks fetched successfully",
    );
  } catch (error) {
    console.error("Error in getAllTasks:", error);

    return errorResponse(res, 500, "Internal server error");
  } finally {
    client.release();
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
      SELECT task_id, builder_id
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

    await client.query("DELETE FROM task WHERE task_id = $1", [task_id]);
    await client.query("COMMIT");
    return successResponse(res, {}, "Task deleted successfully");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error deleting task:", error);
    return errorResponse(res, 500, "Internal server error");
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
      WHERE task_id = $1 AND builder_id = $2
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

    const transformed = keysToCamelCase(updateResult.rows[0]);

    transformed.assigneeName = assigneeName;
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
      "priority",
      "status",
      "attachFiles",
      "createdBy",
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
    return errorResponse(res, 500, "Internal server error");
  } finally {
    client.release();
  }
}
