const getPool = require("../config/database");
const { successResponse, errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.createAction = async (req, res) => {
  const { lead_id } = req.params;
  const builderId = req.user.builder_id;
  const {
    type,
    message,
    tags,
    attachment,
    sendToCustomer,
    createFollowUpTask,
    task,
    recipient,
    title,
    date,
    start_time,
    end_time,
  } = req.body;

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const checkLeadExists = await client.query(
      `SELECT * FROM leads WHERE lead_id = $1 AND builder_id = $2 AND is_deleted = false`,
      [lead_id, builderId]
    );

    if (checkLeadExists.rowCount === 0) {
      return errorResponse(res, 404, "Lead not found.");
    }

    const insertAction = `
      INSERT INTO actions (type, builder_id, lead_id, created_by_id, updated_by_id)
      VALUES ($1, $2, $3, $4, $4)
      RETURNING action_id
    `;
    const result = await client.query(insertAction, [
      type,
      builderId,
      lead_id,
      req.user.user_id,
    ]);
    const actionId = result.rows[0].action_id;

    let tagIds = [];
    if (tags && tags.length > 0) {
      for (const tagName of tags) {
        const tagRes = await client.query(
          `INSERT INTO tags (builder_id, name)
           VALUES ($1, $2)
           ON CONFLICT (builder_id, name) DO UPDATE SET name = EXCLUDED.name
           RETURNING tag_id`,
          [builderId, tagName]
        );
        tagIds.push(tagRes.rows[0].tag_id);
      }
    }

    if (type === "NOTES") {
      let taskId = null;

      if (createFollowUpTask && task) {
        const taskRes = await client.query(
          `INSERT INTO task (action_id, name, due_date, priority, description)
           VALUES ($1, $2, $3, $4, $5) RETURNING task_id`,
          [
            actionId,
            task.name,
            task.due_date,
            task.priority,
            task.description || null,
          ]
        );
        taskId = taskRes.rows[0].task_id;
      }

      await client.query(
        `INSERT INTO notes (action_id, message, tags, attachment, task_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [actionId, message, tagIds, attachment || null, taskId]
      );
    }

    if (type === "SMS") {
      await client.query(
        `INSERT INTO sms (action_id, recipient, message)
         VALUES ($1, $2, $3)`,
        [actionId, recipient, message]
      );
    }

    if (type === "APPOINTMENT") {
      await client.query(
        `INSERT INTO appointment (action_id, title, date, start_time, end_time)
         VALUES ($1, $2, $3, $4, $5)`,
        [actionId, title, date, start_time, end_time]
      );
    }

    if (type === "TASK") {
      await client.query(
        `INSERT INTO task (action_id, name, due_date, priority, description)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          actionId,
          task.name,
          task.due_date,
          task.priority,
          task.description || null,
        ]
      );
    }

    await client.query("COMMIT");

    return successResponse(res, { actionId }, "Action created successfully.");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Create action error:", error);
    return errorResponse(res, 500, "Failed to create action.");
  } finally {
    client.release();
  }
};

exports.getAction = async (req, res) => {
  const { filter = "all" } = req.query;
  const pool = getPool();
  const client = await pool.connect();
  const builderId = req.user.builder_id;
  const leadId = req.params.lead_id;

  try {
    let actionQuery = `SELECT * FROM actions WHERE lead_id = $1 AND builder_id = $2`;
    const queryParams = [leadId, builderId];

    if (filter !== "all") {
      actionQuery += ` AND type = $3`;
      queryParams.push(filter.toUpperCase());
    }

    actionQuery += ` ORDER BY created_at DESC`;

    const actionResult = await client.query(actionQuery, queryParams);
    if (actionResult.rows.length === 0) {
      return errorResponse(res, 404, "No actions found.");
    }

    const actions = keysToCamelCase(actionResult.rows);
    const actionIds = actions.map((a) => a.actionId);

    const responseData = actions.map((a) => ({ ...a }));

    const attachToActions = (rows, key, foreignKey = "actionId") => {
      const grouped = rows.reduce((acc, row) => {
        acc[row[foreignKey]] = acc[row[foreignKey]] || [];
        acc[row[foreignKey]].push(row);
        return acc;
      }, {});
      responseData.forEach((action) => {
        action[key] = grouped[action.actionId] || [];
      });
    };

    if (filter === "all" || filter.toUpperCase() === "NOTES") {
      const notesRes = await client.query(
        `SELECT * FROM notes WHERE action_id = ANY($1) AND is_deleted = false`,
        [actionIds]
      );
      const notes = keysToCamelCase(notesRes.rows);

      const allTagIds = notes.flatMap((n) => n.tags || []);
      let tagsMap = {};
      if (allTagIds.length > 0) {
        const tagsRes = await client.query(`SELECT tag_id, name FROM tags WHERE tag_id = ANY($1) AND is_deleted = false`, [allTagIds]);
        const tags = keysToCamelCase(tagsRes.rows);
        tagsMap = Object.fromEntries(tags.map((t) => [t.tagId, t]));
      }

      const noteTaskIds = notes.filter((n) => n.taskId).map((n) => n.taskId);
      let noteTasks = [];
      if (noteTaskIds.length > 0) {
        const taskRes = await client.query(`SELECT * FROM task WHERE task_id = ANY($1) AND is_deleted = false`, [noteTaskIds]);
        noteTasks = keysToCamelCase(taskRes.rows);
      }

      const taskMap = Object.fromEntries(noteTasks.map((t) => [t.taskId, t]));
      notes.forEach((note) => {
        if (note.taskId) {
          note.task = taskMap[note.taskId] || null;
        }
        if (note.tags && note.tags.length > 0) {
          note.tags = note.tags.map((tid) => tagsMap[tid]).filter(Boolean);
        } else {
          note.tags = [];
        }
      });

      attachToActions(notes, "notes");
    }

    if (filter === "all" || filter.toUpperCase() === "SMS") {
      const smsRes = await client.query(
        `SELECT * FROM sms WHERE action_id = ANY($1) AND is_deleted = false`,
        [actionIds]
      );
      attachToActions(keysToCamelCase(smsRes.rows), "sms");
    }

    if (filter === "all" || filter.toUpperCase() === "APPOINTMENT") {
      const appointmentRes = await client.query(
        `SELECT * FROM appointment WHERE action_id = ANY($1) AND is_deleted = false`,
        [actionIds]
      );
      attachToActions(keysToCamelCase(appointmentRes.rows), "appointment");
    }

    if (filter === "all" || filter.toUpperCase() === "TASK") {
      const taskRes = await client.query(
        `SELECT * FROM task WHERE action_id = ANY($1) AND is_deleted = false`,
        [actionIds]
      );
      attachToActions(keysToCamelCase(taskRes.rows), "task");
    }

    return successResponse(res, responseData, "Actions fetched successfully.");
  } catch (error) {
    console.error("Get action error:", error);
    return errorResponse(res, 500, "Failed to fetch actions.");
  } finally {
    client.release();
  }
};
