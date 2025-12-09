const getPool = require("../config/database");
const { successResponse, errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.createTask = async (req, res) => {
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
      priority = "Medium",
      status = "Yet to Start",
    } = req.body;

    if (!builderId || !companyId) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "Invalid builder or company");
    }

    if (assignee_id) {
      const assigneeCheck = await client.query(
        `SELECT users_id FROM users WHERE users_id = $1`,
        [assignee_id]
      );
      if (assigneeCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Invalid assignee_id");
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
        priority,
        status,
        created_by,
        updated_by
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
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
      priority,
      status,
      createdBy,
      createdBy,
    ]);

    await client.query("COMMIT");

    return successResponse(
      res,
      {
        task: keysToCamelCase(result.rows[0]),
      },
      "Task created successfully"
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error creating task:", error);
    return errorResponse(res, 500, "Internal server error");
  } finally {
    client.release();
  }
};

exports.getAllTasks = async (req, res) => {
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

    const whereClause =
      filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM task t
      ${whereClause}
    `;
    const countResult = await client.query(countQuery, values);
    const totalRecords = parseInt(countResult.rows[0].total, 10);
    const totalPages = Math.ceil(totalRecords / limitValue);

    const dataQuery = `
      SELECT *
      FROM task t
      ${whereClause}
      ORDER BY t.created_at DESC
      LIMIT ${limitValue}
      OFFSET ${offset}
    `;

    const dataResult = await client.query(dataQuery, values);

    return successResponse(
      res,
      {
        tasks: keysToCamelCase(dataResult.rows),
        pagination: {
          currentPage: pageValue,
          totalPages,
          totalRecords,
          limit: limitValue,
        },
      },
      "Tasks fetched successfully"
    );
  } catch (error) {
    console.error("Error in getAllTasks:", error);
    return errorResponse(res, 500, "Internal server error");
  } finally {
    client.release();
  }
};

exports.deleteTask = async (req, res) => {
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
        "You cannot delete tasks of another builder"
      );
    }

    await client.query(`DELETE FROM task WHERE task_id = $1`, [task_id]);

    await client.query("COMMIT");

    return successResponse(res, {}, "Task deleted successfully");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error deleting task:", error);
    return errorResponse(res, 500, "Internal server error");
  } finally {
    client.release();
  }
};

exports.updateTask = async (req, res) => {
  const { task_id } = req.params;
  const builderId = req.user?.builder_id;
  const userId = req.user?.user_id;

  const {
    name,
    description,
    due_date,
    due_time,
    assignee_id,
    priority,
    status,
  } = req.body;

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
        "Task not found or you do not have permission to update it"
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
        `SELECT users_id FROM users WHERE users_id = $1`,
        [assignee_id]
      );

      if (assigneeCheck.rows.length === 0) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "Invalid assignee_id. You can assign only your own builder users"
        );
      }

      fields.push(`assignee_id = $${index}`);
      values.push(assignee_id);
      index++;
    }

    if (fields.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "No fields to update");
    }

    fields.push(`updated_at = NOW()`);
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

    return successResponse(
      res,
      {
        task: keysToCamelCase(updateResult.rows[0]),
      },
      "Task updated successfully"
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error updating task:", error);
    return errorResponse(res, 500, "Internal server error");
  } finally {
    client.release();
  }
};
