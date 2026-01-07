const getPool = require("../config/database");
const {
  ensureWorkflowStageBySubStageId,
} = require("./job-process-workflow.guard");

/**
 * CREATE TASK + DEPENDENCIES
 */
exports.createTaskService = async (subStageId, payload, builderId, companyId) => {
  await ensureWorkflowStageBySubStageId(subStageId);

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Check if sub-stage exists
    const subStageCheck = await client.query(
      `
      SELECT ss.sub_stage_id, ss.stage_id
      FROM job_process_sub_stage ss
      WHERE ss.sub_stage_id = $1 
      `,
      [subStageId]
    );

    if (subStageCheck.rows.length === 0) {
      throw new Error("Sub-stage not found");
    }

    // Get parent stage info for authorization
    const stageCheck = await client.query(
      `
      SELECT stage_id, builder_id, company_id
      FROM job_process_stage
      WHERE stage_id = $1
      `,
      [subStageCheck.rows[0].stage_id]
    );

    if (stageCheck.rows.length === 0) {
      throw new Error("Parent stage not found");
    }

    const stageInfo = stageCheck.rows[0];

    // Authorization check - user can only create tasks for their own sub-stages
    if (stageInfo.builder_id !== builderId && stageInfo.company_id !== companyId) {
      throw new Error("You can only create tasks for your own sub-stages");
    }

    if (payload.assignee_id) {
      const assigneeCheck = await client.query(
        `
        SELECT users_id, builder_id, is_deleted, is_verified
        FROM users
        WHERE users_id = $1
        `,
        [payload.assignee_id]
      );

      if (assigneeCheck.rows.length === 0) {
        throw new Error("Assignee user not found");
      }

      const assigneeInfo = assigneeCheck.rows[0];

      if (assigneeInfo.is_deleted) {
        throw new Error("Cannot assign task to deleted user");
      }

      if (!assigneeInfo.is_verified) {
        throw new Error("Cannot assign task to unverified user");
      }

      // If caller is scoped to a builder, enforce same-builder assignee.
      // if (builderId && assigneeInfo.builder_id !== builderId) {
      //   throw new Error("Cannot assign task to user from different organization");
      // }
    }

    const duplicateCheck = await client.query(
      `
      SELECT job_process_task_id 
      FROM job_process_task
      WHERE sub_stage_id = $1 
        AND name = $2
      `,
      [subStageId, payload.name]
    );

    if (duplicateCheck.rows.length > 0) {
      throw new Error(`Task with name ${payload.name} already exists for this sub-stage`);
    }

    const maxSortOrderQuery = `
      SELECT COALESCE(MAX(sort_order), 0) AS max_sort_order
      FROM job_process_task
      WHERE sub_stage_id = $1
    `;
    const maxSortOrderResult = await client.query(maxSortOrderQuery, [subStageId]);
    const maxSortOrder = maxSortOrderResult.rows[0].max_sort_order;

    let finalSortOrder;
    if (payload.sort_order !== undefined) {
      finalSortOrder = payload.sort_order;
    } else {
      finalSortOrder = maxSortOrder + 1;
    }

    if (finalSortOrder < 1 || finalSortOrder > maxSortOrder + 1) {
      throw new Error(`Invalid sort_order. Allowed range is 1 to ${maxSortOrder + 1}.`);
    }

    if (payload.sort_order !== undefined) {
      const shiftSortOrderQuery = `
        UPDATE job_process_task
        SET sort_order = sort_order + 1
        WHERE sub_stage_id = $1 
          AND sort_order >= $2
      `;
      await client.query(shiftSortOrderQuery, [subStageId, payload.sort_order]);
    }

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
        finalSortOrder,
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
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Get current task info
    const checkQuery = await client.query(
      `
      SELECT job_process_task_id, sub_stage_id, name, sort_order
      FROM job_process_task
      WHERE job_process_task_id = $1
      `,
      [taskId]
    );

    if (checkQuery.rows.length === 0) {
      throw new Error("Task not found");
    }

    const existingTask = checkQuery.rows[0];

    // Check for duplicate name (excluding current task)
    if (payload.name && payload.name !== existingTask.name) {
      const duplicateCheck = await client.query(
        `
        SELECT job_process_task_id 
        FROM job_process_task
        WHERE sub_stage_id = $1 
          AND name = $2
          AND job_process_task_id != $3
        `,
        [existingTask.sub_stage_id, payload.name, taskId]
      );

      if (duplicateCheck.rows.length > 0) {
        throw new Error(`Task with name ${payload.name} already exists for this sub-stage`);
      }
    }

    // Handle sort order shifting if sort_order is being updated
    if (payload.sort_order !== undefined && payload.sort_order !== existingTask.sort_order) {
      const maxSortOrderQuery = `
        SELECT COALESCE(MAX(sort_order), 0) AS max_sort_order
        FROM job_process_task
        WHERE sub_stage_id = $1
      `;
      const maxSortOrderResult = await client.query(maxSortOrderQuery, [existingTask.sub_stage_id]);
      const maxSortOrder = maxSortOrderResult.rows[0].max_sort_order;

      // Validate sort order range
      if (payload.sort_order < 1 || payload.sort_order > maxSortOrder + 1) {
        throw new Error(`Invalid sort_order. Allowed range is 1 to ${maxSortOrder + 1}.`);
      }

      // Shift sort orders based on movement direction
      if (payload.sort_order > existingTask.sort_order) {
        // Moving down: decrement sort_order for tasks between old and new position
        await client.query(
          `
          UPDATE job_process_task
          SET sort_order = sort_order - 1
          WHERE sort_order > $1
            AND sort_order <= $2
            AND job_process_task_id != $3
            AND sub_stage_id = $4
          `,
          [existingTask.sort_order, payload.sort_order, taskId, existingTask.sub_stage_id]
        );
      } else {
        // Moving up: increment sort_order for tasks between new and old position
        await client.query(
          `
          UPDATE job_process_task
          SET sort_order = sort_order + 1
          WHERE sort_order >= $1
            AND sort_order < $2
            AND job_process_task_id != $3
            AND sub_stage_id = $4
          `,
          [payload.sort_order, existingTask.sort_order, taskId, existingTask.sub_stage_id]
        );
      }
    }

    const { rows, rowCount } = await client.query(
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

    await client.query("COMMIT");
    return rows[0];
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

exports.deleteTask = async (taskId) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Get task info before deletion
    const checkQuery = await client.query(
      `
      SELECT job_process_task_id, sub_stage_id, sort_order
      FROM job_process_task
      WHERE job_process_task_id = $1
      `,
      [taskId]
    );

    if (checkQuery.rows.length === 0) {
      throw new Error("Task not found");
    }

    const existingSortOrder = checkQuery.rows[0].sort_order;
    const subStageId = checkQuery.rows[0].sub_stage_id;

    // Shift sort order: decrement sort_order for all tasks > deleted task
    await client.query(
      `
      UPDATE job_process_task
      SET sort_order = sort_order - 1
      WHERE sub_stage_id = $1 
        AND sort_order > $2
      `,
      [subStageId, existingSortOrder]
    );

    // Delete the task
    await client.query(
      `DELETE FROM job_process_task WHERE job_process_task_id = $1`,
      [taskId]
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
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
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Check for duplicate sub-task name within the same task
    const duplicateCheck = await client.query(
      `
      SELECT job_process_subtask_id 
      FROM job_process_subtask
      WHERE job_process_task_id = $1 
        AND name = $2
      `,
      [taskId, payload.name]
    );

    if (duplicateCheck.rows.length > 0) {
      throw new Error(`Sub-task with name ${payload.name} already exists for this task`);
    }

    // Get max sort_order for existing sub-tasks to shift
    const maxSortOrderQuery = `
      SELECT COALESCE(MAX(sort_order), 0) AS max_sort_order
      FROM job_process_subtask
      WHERE job_process_task_id = $1
    `;
    const maxSortOrderResult = await client.query(maxSortOrderQuery, [taskId]);
    const maxSortOrder = maxSortOrderResult.rows[0].max_sort_order;

    // Determine final sort order
    let finalSortOrder;
    if (payload.sort_order !== undefined) {
      finalSortOrder = payload.sort_order;
    } else {
      finalSortOrder = maxSortOrder + 1;
    }

    // Validate sort order range
    if (finalSortOrder < 1 || finalSortOrder > maxSortOrder + 1) {
      throw new Error(`Invalid sort_order. Allowed range is 1 to ${maxSortOrder + 1}.`);
    }

    // If sort_order is provided, shift all sub-tasks >= provided sort_order
    if (payload.sort_order !== undefined) {
      const shiftSortOrderQuery = `
        UPDATE job_process_subtask
        SET sort_order = sort_order + 1
        WHERE job_process_task_id = $1 
          AND sort_order >= $2
      `;
      await client.query(shiftSortOrderQuery, [taskId, payload.sort_order]);
    }

    const { rows } = await client.query(
      `
      INSERT INTO job_process_subtask
      (job_process_task_id, name, sort_order)
      VALUES ($1,$2,$3)
      RETURNING *
      `,
      [taskId, payload.name, finalSortOrder]
    );

    await client.query("COMMIT");
    return rows[0];
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

/**
 * UPDATE SUB-TASK
 */
exports.updateSubTask = async (subTaskId, payload) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Get current sub-task info
    const checkQuery = await client.query(
      `
      SELECT job_process_subtask_id, job_process_task_id, name, sort_order
      FROM job_process_subtask
      WHERE job_process_subtask_id = $1
      `,
      [subTaskId]
    );

    if (checkQuery.rows.length === 0) {
      throw new Error("Sub-task not found");
    }

    const existingSubTask = checkQuery.rows[0];

    // Check for duplicate name (excluding current sub-task)
    if (payload.name && payload.name !== existingSubTask.name) {
      const duplicateCheck = await client.query(
        `
        SELECT job_process_subtask_id 
        FROM job_process_subtask
        WHERE job_process_task_id = $1 
          AND name = $2
          AND job_process_subtask_id != $3
        `,
        [existingSubTask.job_process_task_id, payload.name, subTaskId]
      );

      if (duplicateCheck.rows.length > 0) {
        throw new Error(`Sub-task with name ${payload.name} already exists for this task`);
      }
    }

    // Handle sort order shifting if sort_order is being updated
    if (payload.sort_order !== undefined && payload.sort_order !== existingSubTask.sort_order) {
      const maxSortOrderQuery = `
        SELECT COALESCE(MAX(sort_order), 0) AS max_sort_order
        FROM job_process_subtask
        WHERE job_process_task_id = $1
      `;
      const maxSortOrderResult = await client.query(maxSortOrderQuery, [existingSubTask.job_process_task_id]);
      const maxSortOrder = maxSortOrderResult.rows[0].max_sort_order;

      // Validate sort order range
      if (payload.sort_order < 1 || payload.sort_order > maxSortOrder + 1) {
        throw new Error(`Invalid sort_order. Allowed range is 1 to ${maxSortOrder + 1}.`);
      }

      // Shift sort orders based on movement direction
      if (payload.sort_order > existingSubTask.sort_order) {
        // Moving down: decrement sort_order for sub-tasks between old and new position
        await client.query(
          `
          UPDATE job_process_subtask
          SET sort_order = sort_order - 1
          WHERE sort_order > $1
            AND sort_order <= $2
            AND job_process_subtask_id != $3
            AND job_process_task_id = $4
          `,
          [existingSubTask.sort_order, payload.sort_order, subTaskId, existingSubTask.job_process_task_id]
        );
      } else {
        // Moving up: increment sort_order for sub-tasks between new and old position
        await client.query(
          `
          UPDATE job_process_subtask
          SET sort_order = sort_order + 1
          WHERE sort_order >= $1
            AND sort_order < $2
            AND job_process_subtask_id != $3
            AND job_process_task_id = $4
          `,
          [payload.sort_order, existingSubTask.sort_order, subTaskId, existingSubTask.job_process_task_id]
        );
      }
    }

    const { rows, rowCount } = await client.query(
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

    await client.query("COMMIT");
    return rows[0];
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

/**
 * DELETE SUB-TASK
 */
exports.deleteSubTask = async (subTaskId) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Get sub-task info before deletion
    const checkQuery = await client.query(
      `
      SELECT job_process_subtask_id, job_process_task_id, sort_order
      FROM job_process_subtask
      WHERE job_process_subtask_id = $1
      `,
      [subTaskId]
    );

    if (checkQuery.rows.length === 0) {
      throw new Error("Sub-task not found");
    }

    const existingSortOrder = checkQuery.rows[0].sort_order;
    const taskId = checkQuery.rows[0].job_process_task_id;

    // Shift sort order: decrement sort_order for all sub-tasks > deleted sub-task
    await client.query(
      `
      UPDATE job_process_subtask
      SET sort_order = sort_order - 1
      WHERE job_process_task_id = $1 
        AND sort_order > $2
      `,
      [taskId, existingSortOrder]
    );

    // Delete sub-task
    await client.query(
      `
      DELETE FROM job_process_subtask
      WHERE job_process_subtask_id = $1
      `,
      [subTaskId]
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
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
