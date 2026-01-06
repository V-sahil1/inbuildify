const getPool = require("../config/database");
const {
  ensureWorkflowStageBySubStageId,
} = require("./job-process-workflow.guard");

/**
 * CREATE TASK + DEPENDENCIES
 */
exports.createTaskService = async (subStageId, payload) => {
  await ensureWorkflowStageBySubStageId(subStageId);

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `
      INSERT INTO job_process_task
      (sub_stage_id, name, description, sort_order, no_of_days,
       assignee_id, notify, milestone, attachment_mandatory)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING *
      `,
      [
        subStageId,
        payload.name,
        payload.description,
        payload.sort_order,
        payload.no_of_days,
        payload.assignee_id,
        payload.notify,
        payload.milestone,
        payload.attachment_mandatory,
      ]
    );

    const taskId = rows[0].job_process_task_id;

    for (const depId of payload.predecessor_task_ids || []) {
      if (depId === taskId) {
        throw new Error("Task cannot depend on itself");
      }

      await client.query(
        `
        INSERT INTO job_process_task_dependency(task_id, predecessor_task_id)
        VALUES ($1,$2)
        `,
        [taskId, depId]
      );
    }

    await client.query("COMMIT");
    return rows[0];
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
};

exports.updateTask = async (taskId, payload) => {
  const pool = getPool();
  const { rows, rowCount } = await pool.query(
    `
    UPDATE job_process_task
    SET
      name = COALESCE($2, name),
      description = COALESCE($3, description),
      sort_order = COALESCE($4, sort_order),
      no_of_days = COALESCE($5, no_of_days),
      assignee_id = COALESCE($6, assignee_id),
      notify = COALESCE($7, notify),
      milestone = COALESCE($8, milestone),
      attachment_mandatory = COALESCE($9, attachment_mandatory),
      updated_at = NOW()
    WHERE job_process_task_id = $1
    RETURNING *
    `,
    [
      taskId,
      payload.name,
      payload.description,
      payload.sort_order,
      payload.no_of_days,
      payload.assignee_id,
      payload.notify,
      payload.milestone,
      payload.attachment_mandatory,
    ]
  );

  if (!rowCount) throw new Error("Task not found");
  return rows[0];
};

exports.deleteTask = async (taskId) => {
  const pool = getPool();
  await pool.query(
    `DELETE FROM job_process_task WHERE job_process_task_id = $1`,
    [taskId]
  );
};

exports.getTasks = async (subStageId) => {
  const pool = getPool();

  const { rows } = await pool.query(
    `
    SELECT
      t.job_process_task_id,
      t.name,
      t.description,
      t.sort_order,
      t.no_of_days,
      t.assignee_id,
      t.notify,
      t.milestone,
      t.attachment_mandatory,

      d.predecessor_task_id,
      pt.name AS predecessor_task_name,

      st.job_process_subtask_id,
      st.name AS subtask_name,
      st.sort_order AS subtask_order

    FROM job_process_task t
    LEFT JOIN job_process_task_dependency d
      ON d.task_id = t.job_process_task_id
    LEFT JOIN job_process_task pt
      ON pt.job_process_task_id = d.predecessor_task_id
    LEFT JOIN job_process_subtask st
      ON st.job_process_task_id = t.job_process_task_id
    WHERE t.sub_stage_id = $1
    ORDER BY t.sort_order, st.sort_order
    `,
    [subStageId]
  );

  const taskMap = new Map();

  for (const r of rows) {
    if (!taskMap.has(r.job_process_task_id)) {
      taskMap.set(r.job_process_task_id, {
        taskId: r.job_process_task_id,
        name: r.name,
        description: r.description,
        sortOrder: r.sort_order,
        noOfDays: r.no_of_days,
        assigneeId: r.assignee_id,
        notify: r.notify,
        milestone: r.milestone,
        attachmentMandatory: r.attachment_mandatory,
        dependencies: [],
        subTasks: [],
      });
    }

    const task = taskMap.get(r.job_process_task_id);

    // Dependency with ID + name
    if (r.predecessor_task_id) {
      const exists = task.dependencies.find(
        (d) => d.taskId === r.predecessor_task_id
      );

      if (!exists) {
        task.dependencies.push({
          taskId: r.predecessor_task_id,
          name: r.predecessor_task_name,
        });
      }
    }

    // Sub-tasks
    if (r.job_process_subtask_id) {
      const exists = task.subTasks.find(
        (st) => st.subTaskId === r.job_process_subtask_id
      );

      if (!exists) {
        task.subTasks.push({
          subTaskId: r.job_process_subtask_id,
          name: r.subtask_name,
          sortOrder: r.subtask_order,
        });
      }
    }
  }

  return Array.from(taskMap.values());
};

/**
 * CREATE SUB-TASK
 */
exports.createSubTask = async (taskId, payload) => {
  const pool = getPool();

  const { rows } = await pool.query(
    `
    INSERT INTO job_process_subtask
    (job_process_task_id, name, sort_order)
    VALUES ($1,$2,$3)
    RETURNING *
    `,
    [taskId, payload.name, payload.sort_order]
  );

  return rows[0];
};

/**
 * UPDATE SUB-TASK
 */
exports.updateSubTask = async (subTaskId, payload) => {
  const pool = getPool();

  const { rows, rowCount } = await pool.query(
    `
    UPDATE job_process_subtask
    SET
      name = COALESCE($2, name),
      sort_order = COALESCE($3, sort_order),
      updated_at = NOW()
    WHERE job_process_subtask_id = $1
    RETURNING *
    `,
    [subTaskId, payload.name, payload.sort_order]
  );

  if (!rowCount) throw new Error("Sub-task not found");
  return rows[0];
};

/**
 * DELETE SUB-TASK
 */
exports.deleteSubTask = async (subTaskId) => {
  const pool = getPool();

  await pool.query(
    `
    DELETE FROM job_process_subtask
    WHERE job_process_subtask_id = $1
    `,
    [subTaskId]
  );
};

/**
 * GET SUB-TASKS BY TASK
 */
exports.getSubTasks = async (taskId) => {
  const pool = getPool();

  const { rows } = await pool.query(
    `
    SELECT
      job_process_subtask_id,
      name,
      sort_order,
      created_at
    FROM job_process_subtask
    WHERE job_process_task_id = $1
    ORDER BY sort_order
    `,
    [taskId]
  );

  return rows;
};
