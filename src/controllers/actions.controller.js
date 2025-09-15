const getPool = require("../config/database");
const { successResponse, errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.createAction = async (req, res) => {
  const { lead_id } = req.params;
  const builderId = req.user.builder_id;
  const attachment = req.file?.location;
  const {
    type,
    message,
    tags,
    sendToCustomer,
    createFollowUpTask,
    task,
    recipient,
    title,
    date,
    start_time,
    end_time,
    location,
    select_users,
    notes,
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
      RETURNING *
    `;
    const result = await client.query(insertAction, [
      type,
      builderId,
      lead_id,
      req.user.user_id,
    ]);
    const action = result.rows[0];

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

    let details = null;
    if (type === "NOTES") {
      let taskId = null;

      if (createFollowUpTask && task) {
        const taskRes = await client.query(
          `INSERT INTO task (action_id, name, due_date, priority, description)
           VALUES ($1, $2, $3, $4, $5) RETURNING *`,
          [
            action.action_id,
            task.name,
            task.due_date,
            task.priority,
            task.description || null,
          ]
        );
        taskId = taskRes.rows[0].task_id;
      }

      const notesRes = await client.query(
        `INSERT INTO notes (action_id, message, tags, attachment, task_id)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [action.action_id, message, tagIds, attachment || null, taskId]
      );
      details = notesRes.rows[0];
    }

    if (type === "SMS") {
      const recipients = Array.isArray(recipient) ? recipient : [recipient];

      const contactCheckQuery = `
        SELECT leads_contact_id, name
        FROM leads_contact
        WHERE leads_contact_id = ANY($1::uuid[])
          AND lead_id = $2
      `;
      const contactCheckRes = await client.query(contactCheckQuery, [
        recipients,
        lead_id,
      ]);

      const foundIds = contactCheckRes.rows.map((r) => r.leads_contact_id);
      const missing = recipients.filter((id) => !foundIds.includes(id));

      if (missing.length > 0) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          404,
          `Recipients not found: ${missing.join(", ")}`
        );
      }

      const smsRes = await client.query(
        `INSERT INTO sms (action_id, recipient, message)
         VALUES ($1, $2::uuid[], $3) RETURNING *`,
        [action.action_id, recipients, message]
      );
      
      details = {
        smsId: smsRes.rows[0].sms_id,
        actionId: smsRes.rows[0].action_id,
        recipient: recipients.map((id) => {
          const contact = contactCheckRes.rows.find((c) => c.leads_contact_id === id);
          return {
            id,
            name: contact ? contact.name : null,
          };
        }),
        message: smsRes.rows[0].message,
        isDeleted: smsRes.rows[0].is_deleted,
        createdAt: smsRes.rows[0].created_at,
        updatedAt: smsRes.rows[0].updated_at,
      };      
    }

    if (type === "APPOINTMENT") {
      if (select_users && select_users.length > 0) {
        const selectUsersRes = await client.query(
          `SELECT users_id FROM users WHERE users_id = ANY($1::uuid[]) AND builder_id = $2 AND is_verified = true AND is_deleted = false`,
          [select_users, builderId]
        );
        if (selectUsersRes.rowCount === 0) {
          await client.query("ROLLBACK");
          return errorResponse(res, 404, "Select users not found or not verified.");
        }
      }
      const appointmentRes = await client.query(
        `INSERT INTO appointment (action_id, title, date, start_time, end_time, location, select_users, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [action.action_id, title, date, start_time, end_time, location, select_users, notes]
      );
      details = appointmentRes.rows[0];
    }

    if (type === "TASK") {
      if (task.assignee) {
        const assigneeRes = await client.query(
          `SELECT users_id FROM users WHERE users_id = $1 AND builder_id = $2 AND is_verified = true AND is_deleted = false`,
          [task.assignee, builderId]
        );
        if (assigneeRes.rowCount === 0) {
          await client.query("ROLLBACK");
          return errorResponse(res, 404, "Assignee not found or not verified.");
        }
      }

      const taskRes = await client.query(
        `INSERT INTO task (action_id, name, due_date, priority, description, time, assignee, attachment)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [
          action.action_id,
          task.name,
          task.due_date,
          task.priority,
          task.description || null,
          task.time || null,
          task.assignee || null,
          attachment || null,
        ]
      );
      details = taskRes.rows[0];
    }

    await client.query("COMMIT");

    return successResponse(res, keysToCamelCase({ ...action, [type]: keysToCamelCase(details), sendToCustomer, createFollowUpTask }), "Action created successfully.");
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
      return errorResponse(res, 200, []);
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
