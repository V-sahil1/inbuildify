import getPool from "../../config/database";
import { ensureWorkflowStageBySubStageId } from "./job-process-workflow.guard";

/**
 * CREATE TASK + DEPENDENCIES
 */
export async function createTaskService(subStageId, payload, builderId, companyId) {
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
      [subStageId],
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
      [subStageCheck.rows[0].stage_id],
    );

    if (stageCheck.rows.length === 0) {
      throw new Error("Parent stage not found");
    }

    const stageInfo = stageCheck.rows[0];

    // Authorization check - user can only create tasks for their own sub-stages
    if (
      stageInfo.builder_id !== builderId &&
      stageInfo.company_id !== companyId
    ) {
      throw new Error("You can only create tasks for your own sub-stages");
    }

    if (payload.assignee_id) {
      const assigneeCheck = await client.query(
        `
        SELECT users_id, builder_id, is_deleted, is_verified
        FROM users
        WHERE users_id = $1
        `,
        [payload.assignee_id],
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

    if (payload.folder_id) {
      const folderCheck = await client.query(
        `
        SELECT document_common_folder_id
        FROM document_common_folder
        WHERE document_common_folder_id = $1
        `,
        [payload.folder_id],
      );

      if (folderCheck.rows.length === 0) {
        throw new Error("Folder not found");
      }
    }

    const duplicateCheck = await client.query(
      `
      SELECT job_process_task_id 
      FROM job_process_task
      WHERE sub_stage_id = $1 
        AND name = $2
      `,
      [subStageId, payload.name],
    );

    if (duplicateCheck.rows.length > 0) {
      throw new Error(
        `Task with name ${payload.name} already exists for this sub-stage`,
      );
    }

    const maxSortOrderQuery = `
      SELECT COALESCE(MAX(sort_order), 0) AS max_sort_order
      FROM job_process_task
      WHERE sub_stage_id = $1
    `;
    const maxSortOrderResult = await client.query(maxSortOrderQuery, [
      subStageId,
    ]);
    const maxSortOrder = maxSortOrderResult.rows[0].max_sort_order;

    let finalSortOrder;
    if (payload.sort_order !== undefined) {
      finalSortOrder = payload.sort_order;
    } else {
      finalSortOrder = maxSortOrder + 1;
    }

    if (finalSortOrder < 1 || finalSortOrder > maxSortOrder + 1) {
      throw new Error(
        `Invalid sort_order. Allowed range is 1 to ${maxSortOrder + 1}.`,
      );
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
      (sub_stage_id, name, description, sort_order, folder_id, no_of_days,
       assignee_id, notify, milestone, attachment_mandatory)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *
      `,
      [
        subStageId,
        payload.name,
        payload.description,
        finalSortOrder,
        payload.folder_id || null,
        payload.no_of_days,
        payload.assignee_id,
        payload.notify,
        payload.milestone,
        payload.attachment_mandatory,
      ],
    );

    const taskId = rows[0].job_process_task_id;

    const taskWithAssignee = await client.query(
      `
      SELECT 
        t.*,
        u.users_id as assignee_id,
        u.name as assignee_name
      FROM job_process_task t
      LEFT JOIN users u ON t.assignee_id = u.users_id
      WHERE t.job_process_task_id = $1
      `,
      [taskId],
    );

    for (const depId of payload.predecessor_task_ids || []) {
      if (depId === taskId) {
        throw new Error("Task cannot depend on itself");
      }

      await client.query(
        `
        INSERT INTO job_process_task_dependency(task_id, predecessor_task_id)
        VALUES ($1,$2)
        `,
        [taskId, depId],
      );
    }

    await client.query("COMMIT");

    const task = taskWithAssignee.rows[0];
    const formattedTask = {
      job_process_task_id: task.job_process_task_id,
      sub_stage_id: task.sub_stage_id,
      name: task.name,
      description: task.description,
      sort_order: task.sort_order,
      folder_id: task.folder_id,
      no_of_days: task.no_of_days,
      assignee: task.assignee_id
        ? {
          id: task.assignee_id,
          name: task.assignee_name,
        }
        : null,
      notify: task.notify,
      milestone: task.milestone,
      attachment_mandatory: task.attachment_mandatory,
      created_at: task.created_at,
      updated_at: task.updated_at,
    };

    return formattedTask;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function updateTask(taskId, payload, builderId, companyId) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Authorization check - user can only update tasks for their own sub-stages
    const ownerCheck = await client.query(
      `
      SELECT s.builder_id, s.company_id
      FROM job_process_task t
      JOIN job_process_sub_stage ss ON ss.sub_stage_id = t.sub_stage_id
      JOIN job_process_stage s ON s.stage_id = ss.stage_id
      WHERE t.job_process_task_id = $1
      `,
      [taskId],
    );

    if (ownerCheck.rows.length === 0) {
      throw new Error("Task not found");
    }

    const owner = ownerCheck.rows[0];
    if (owner.builder_id !== builderId && owner.company_id !== companyId) {
      throw new Error("You can only update tasks for your own sub-stages");
    }

    // Validate folder_id if provided
    if (payload.folder_id) {
      const folderCheck = await client.query(
        `
        SELECT document_common_folder_id
        FROM document_common_folder
        WHERE document_common_folder_id = $1
        `,
        [payload.folder_id],
      );

      if (folderCheck.rows.length === 0) {
        throw new Error("Folder not found");
      }
    }

    // Get current task info
    const checkQuery = await client.query(
      `
      SELECT job_process_task_id, sub_stage_id, name, sort_order
      FROM job_process_task
      WHERE job_process_task_id = $1
      `,
      [taskId],
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
        [existingTask.sub_stage_id, payload.name, taskId],
      );

      if (duplicateCheck.rows.length > 0) {
        throw new Error(
          `Task with name ${payload.name} already exists for this sub-stage`,
        );
      }
    }

    // Handle sort order shifting if sort_order is being updated
    if (
      payload.sort_order !== undefined &&
      payload.sort_order !== existingTask.sort_order
    ) {
      const maxSortOrderQuery = `
        SELECT COALESCE(MAX(sort_order), 0) AS max_sort_order
        FROM job_process_task
        WHERE sub_stage_id = $1
      `;
      const maxSortOrderResult = await client.query(maxSortOrderQuery, [
        existingTask.sub_stage_id,
      ]);
      const maxSortOrder = maxSortOrderResult.rows[0].max_sort_order;

      // Validate sort order range
      if (payload.sort_order < 1 || payload.sort_order > maxSortOrder + 1) {
        throw new Error(
          `Invalid sort_order. Allowed range is 1 to ${maxSortOrder + 1}.`,
        );
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
          [
            existingTask.sort_order,
            payload.sort_order,
            taskId,
            existingTask.sub_stage_id,
          ],
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
          [
            payload.sort_order,
            existingTask.sort_order,
            taskId,
            existingTask.sub_stage_id,
          ],
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
        folder_id = COALESCE($5, folder_id),
        no_of_days = COALESCE($6, no_of_days),
        assignee_id = COALESCE($7, assignee_id),
        notify = COALESCE($8, notify),
        milestone = COALESCE($9, milestone),
        attachment_mandatory = COALESCE($10, attachment_mandatory),
        updated_at = NOW()
      WHERE job_process_task_id = $1
      RETURNING *
      `,
      [
        taskId,
        payload.name,
        payload.description,
        payload.sort_order,
        payload.folder_id,
        payload.no_of_days,
        payload.assignee_id,
        payload.notify,
        payload.milestone,
        payload.attachment_mandatory,
      ],
    );

    if (!rowCount) {
      throw new Error("Task not found");
    }

    // Handle predecessor task dependencies
    if (payload.predecessor_task_ids !== undefined) {
      // Clear existing dependencies
      await client.query(
        "DELETE FROM job_process_task_dependency WHERE task_id = $1",
        [taskId],
      );

      // Add new dependencies
      for (const depId of payload.predecessor_task_ids || []) {
        if (depId === taskId) {
          throw new Error("Task cannot depend on itself");
        }

        await client.query(
          `
          INSERT INTO job_process_task_dependency(task_id, predecessor_task_id)
          VALUES ($1, $2)
          `,
          [taskId, depId],
        );
      }
    }

    const { rows: updatedRows } = await client.query(
      `
      SELECT 
        t.*,
        u.users_id as assignee_id,
        u.name as assignee_name,
        COALESCE(
          json_agg(
            json_build_object(
              'id', td.predecessor_task_id,
              'name', pt.name
            )
          ) FILTER (WHERE td.predecessor_task_id IS NOT NULL),
          '[]'
        ) AS predecessor_task_ids
      FROM job_process_task t
      LEFT JOIN job_process_task_dependency td ON t.job_process_task_id = td.task_id
      LEFT JOIN job_process_task pt ON td.predecessor_task_id = pt.job_process_task_id
      LEFT JOIN users u ON t.assignee_id = u.users_id
      WHERE t.job_process_task_id = $1
      GROUP BY t.job_process_task_id, u.users_id, u.name
      `,
      [taskId],
    );

    await client.query("COMMIT");

    const task = updatedRows[0];
    const formattedTask = {
      job_process_task_id: task.job_process_task_id,
      sub_stage_id: task.sub_stage_id,
      name: task.name,
      description: task.description,
      sort_order: task.sort_order,
      folder_id: task.folder_id,
      no_of_days: task.no_of_days,
      assignee: task.assignee_id
        ? {
          id: task.assignee_id,
          name: task.assignee_name,
        }
        : null,
      notify: task.notify,
      milestone: task.milestone,
      attachment_mandatory: task.attachment_mandatory,
      predecessor_task_ids: task.predecessor_task_ids,
      created_at: task.created_at,
      updated_at: task.updated_at,
    };

    return formattedTask;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function deleteTask(taskId, builderId, companyId) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const ownerCheck = await client.query(
      `
      SELECT s.builder_id, s.company_id
      FROM job_process_task t
      JOIN job_process_sub_stage ss ON ss.sub_stage_id = t.sub_stage_id
      JOIN job_process_stage s ON s.stage_id = ss.stage_id
      WHERE t.job_process_task_id = $1
      `,
      [taskId],
    );

    if (ownerCheck.rows.length === 0) {
      throw new Error("Task not found");
    }

    const owner = ownerCheck.rows[0];
    if (owner.builder_id !== builderId && owner.company_id !== companyId) {
      throw new Error("You can only delete tasks for your own sub-stages");
    }

    const checkQuery = await client.query(
      `
      SELECT job_process_task_id, sub_stage_id, sort_order
      FROM job_process_task
      WHERE job_process_task_id = $1
      `,
      [taskId],
    );

    if (checkQuery.rows.length === 0) {
      throw new Error("Task not found");
    }

    const existingSortOrder = checkQuery.rows[0].sort_order;
    const subStageId = checkQuery.rows[0].sub_stage_id;

    await client.query(
      `
      UPDATE job_process_task
      SET sort_order = sort_order - 1
      WHERE sub_stage_id = $1 
        AND sort_order > $2
      `,
      [subStageId, existingSortOrder],
    );

    await client.query(
      "DELETE FROM job_process_task WHERE job_process_task_id = $1",
      [taskId],
    );

    // Remove this task from all dependencies where it's a predecessor
    await client.query(
      "DELETE FROM job_process_task_dependency WHERE predecessor_task_id = $1",
      [taskId],
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function getTasks(subStageId, builderId, companyId) {
  const pool = getPool();

  const { rows } = await pool.query(
    `
    SELECT
      t.job_process_task_id,
      t.name,
      t.description,
      t.sort_order,
      t.folder_id,
      t.no_of_days,
      t.assignee_id,
      u.name AS assignee_name,
      drv.name AS folder_name,
      t.notify,
      t.milestone,
      t.attachment_mandatory,

      dep.predecessor_task_id,
      pt.name AS predecessor_task_name,

      st.job_process_subtask_id,
      st.name AS subtask_name,
      st.sort_order AS subtask_order

    FROM job_process_task t
    JOIN job_process_sub_stage ss
      ON ss.sub_stage_id = t.sub_stage_id
    JOIN job_process_stage s
      ON s.stage_id = ss.stage_id
    LEFT JOIN job_process_task_dependency dep
      ON dep.task_id = t.job_process_task_id
    LEFT JOIN job_process_task pt
      ON pt.job_process_task_id = dep.predecessor_task_id
    LEFT JOIN job_process_subtask st
      ON st.job_process_task_id = t.job_process_task_id
    LEFT JOIN users u
      ON u.users_id = t.assignee_id
    LEFT JOIN document_common_folder drv
      ON drv.document_common_folder_id = t.folder_id
    WHERE t.sub_stage_id = $1
      AND (s.builder_id = $2 OR s.company_id = $3)
    ORDER BY t.sort_order, st.sort_order
    `,
    [subStageId, builderId, companyId],
  );

  const taskMap = new Map();

  for (const r of rows) {
    if (!taskMap.has(r.job_process_task_id)) {
      taskMap.set(r.job_process_task_id, {
        jobProcessTaskId: r.job_process_task_id,
        name: r.name,
        description: r.description,
        sortOrder: r.sort_order,
        noOfDays: r.no_of_days,
        assignee: {
          id: r.assignee_id,
          name: r.assignee_name,
        },
        folder: r.folder_id
          ? {
            id: r.folder_id,
            name: r.folder_name,
          }
          : null,
        notify: r.notify,
        milestone: r.milestone,
        attachmentMandatory: r.attachment_mandatory,
        predecessorTask: [],
        subTasks: [],
      });
    }

    const task = taskMap.get(r.job_process_task_id);

    if (r.predecessor_task_id) {
      const exists = task.predecessorTask.find(
        (d) => d.taskId === r.predecessor_task_id,
      );

      if (!exists) {
        task.predecessorTask.push({
          taskId: r.predecessor_task_id,
          name: r.predecessor_task_name,
        });
      }
    }

    if (r.job_process_subtask_id) {
      const exists = task.subTasks.find(
        (st) => st.subTaskId === r.job_process_subtask_id,
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
}

/**
 * CREATE SUB-TASK
 */
export async function createSubTask(taskId, payload, builderId, companyId) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Authorization check - user can only create sub-tasks for their own tasks
    // (task -> sub_stage -> stage ownership)
    const ownerCheck = await client.query(
      `
      SELECT s.builder_id, s.company_id
      FROM job_process_task t
      JOIN job_process_sub_stage ss ON ss.sub_stage_id = t.sub_stage_id
      JOIN job_process_stage s ON s.stage_id = ss.stage_id
      WHERE t.job_process_task_id = $1
      `,
      [taskId],
    );

    if (ownerCheck.rows.length === 0) {
      throw new Error("Task not found");
    }

    const owner = ownerCheck.rows[0];
    if (owner.builder_id !== builderId && owner.company_id !== companyId) {
      throw new Error("You can only create sub-tasks for your own tasks");
    }

    const duplicateCheck = await client.query(
      `
      SELECT job_process_subtask_id 
      FROM job_process_subtask
      WHERE job_process_task_id = $1 
        AND name = $2
      `,
      [taskId, payload.name],
    );

    if (duplicateCheck.rows.length > 0) {
      throw new Error(
        `Sub-task with name ${payload.name} already exists for this task`,
      );
    }

    const maxSortOrderQuery = `
      SELECT COALESCE(MAX(sort_order), 0) AS max_sort_order
      FROM job_process_subtask
      WHERE job_process_task_id = $1
    `;
    const maxSortOrderResult = await client.query(maxSortOrderQuery, [taskId]);
    const maxSortOrder = maxSortOrderResult.rows[0].max_sort_order;

    let finalSortOrder;
    if (payload.sort_order !== undefined) {
      finalSortOrder = payload.sort_order;
    } else {
      finalSortOrder = maxSortOrder + 1;
    }

    if (finalSortOrder < 1 || finalSortOrder > maxSortOrder + 1) {
      throw new Error(
        `Invalid sort_order. Allowed range is 1 to ${maxSortOrder + 1}.`,
      );
    }

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
      [taskId, payload.name, finalSortOrder],
    );

    const { rows: createdRows } = await client.query(
      `
      SELECT 
        st.*,
        t.job_process_task_id,
        t.name AS task_name
      FROM job_process_subtask st
      JOIN job_process_task t ON t.job_process_task_id = st.job_process_task_id
      WHERE st.job_process_subtask_id = $1
      `,
      [rows[0].job_process_subtask_id],
    );

    await client.query("COMMIT");

    const subTaskData = createdRows[0];
    return {
      jobProcessSubtaskId: subTaskData.job_process_subtask_id,
      name: subTaskData.name,
      sortOrder: subTaskData.sort_order,
      jobProcessTask: {
        id: subTaskData.job_process_task_id,
        name: subTaskData.task_name,
      },
      createdAt: subTaskData.created_at,
      updatedAt: subTaskData.updated_at,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * UPDATE SUB-TASK
 */
export async function updateSubTask(subTaskId, payload, builderId, companyId) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const ownerCheck = await client.query(
      `
      SELECT s.builder_id, s.company_id
      FROM job_process_subtask st
      JOIN job_process_task t ON t.job_process_task_id = st.job_process_task_id
      JOIN job_process_sub_stage ss ON ss.sub_stage_id = t.sub_stage_id
      JOIN job_process_stage s ON s.stage_id = ss.stage_id
      WHERE st.job_process_subtask_id = $1
      `,
      [subTaskId],
    );

    if (ownerCheck.rows.length === 0) {
      throw new Error("Sub-task not found");
    }

    const owner = ownerCheck.rows[0];
    if (owner.builder_id !== builderId && owner.company_id !== companyId) {
      throw new Error("You can only update sub-tasks for your own tasks");
    }

    const checkQuery = await client.query(
      `
      SELECT job_process_subtask_id, job_process_task_id, name, sort_order
      FROM job_process_subtask
      WHERE job_process_subtask_id = $1
      `,
      [subTaskId],
    );

    if (checkQuery.rows.length === 0) {
      throw new Error("Sub-task not found");
    }

    const existingSubTask = checkQuery.rows[0];

    if (payload.name && payload.name !== existingSubTask.name) {
      const duplicateCheck = await client.query(
        `
        SELECT job_process_subtask_id 
        FROM job_process_subtask
        WHERE job_process_task_id = $1 
          AND name = $2
          AND job_process_subtask_id != $3
        `,
        [existingSubTask.job_process_task_id, payload.name, subTaskId],
      );

      if (duplicateCheck.rows.length > 0) {
        throw new Error(
          `Sub-task with name ${payload.name} already exists for this task`,
        );
      }
    }

    if (
      payload.sort_order !== undefined &&
      payload.sort_order !== existingSubTask.sort_order
    ) {
      const maxSortOrderQuery = `
        SELECT COALESCE(MAX(sort_order), 0) AS max_sort_order
        FROM job_process_subtask
        WHERE job_process_task_id = $1
      `;
      const maxSortOrderResult = await client.query(maxSortOrderQuery, [
        existingSubTask.job_process_task_id,
      ]);
      const maxSortOrder = maxSortOrderResult.rows[0].max_sort_order;

      if (payload.sort_order < 1 || payload.sort_order > maxSortOrder + 1) {
        throw new Error(
          `Invalid sort_order. Allowed range is 1 to ${maxSortOrder + 1}.`,
        );
      }

      if (payload.sort_order > existingSubTask.sort_order) {
        await client.query(
          `
          UPDATE job_process_subtask
          SET sort_order = sort_order - 1
          WHERE sort_order > $1
            AND sort_order <= $2
            AND job_process_subtask_id != $3
            AND job_process_task_id = $4
          `,
          [
            existingSubTask.sort_order,
            payload.sort_order,
            subTaskId,
            existingSubTask.job_process_task_id,
          ],
        );
      } else {
        await client.query(
          `
          UPDATE job_process_subtask
          SET sort_order = sort_order + 1
          WHERE sort_order >= $1
            AND sort_order < $2
            AND job_process_subtask_id != $3
            AND job_process_task_id = $4
          `,
          [
            payload.sort_order,
            existingSubTask.sort_order,
            subTaskId,
            existingSubTask.job_process_task_id,
          ],
        );
      }
    }

    const { rows, rowCount } = await client.query(
      `
      UPDATE job_process_subtask
      SET
        name = COALESCE($2, name),
        sort_order = COALESCE($3, sort_order),
        created_at = created_at
      WHERE job_process_subtask_id = $1
      RETURNING *
      `,
      [subTaskId, payload.name, payload.sort_order],
    );

    if (!rowCount) {
      throw new Error("Sub-task not found");
    }

    const { rows: updatedRows } = await client.query(
      `
      SELECT 
        st.*,
        t.job_process_task_id,
        t.name AS task_name
      FROM job_process_subtask st
      JOIN job_process_task t ON t.job_process_task_id = st.job_process_task_id
      WHERE st.job_process_subtask_id = $1
      `,
      [subTaskId],
    );

    await client.query("COMMIT");

    const subTaskData = updatedRows[0];
    return {
      jobProcessSubtaskId: subTaskData.job_process_subtask_id,
      name: subTaskData.name,
      sortOrder: subTaskData.sort_order,
      jobProcessTask: {
        id: subTaskData.job_process_task_id,
        name: subTaskData.task_name,
      },
      createdAt: subTaskData.created_at,
      updatedAt: subTaskData.updated_at,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * DELETE SUB-TASK
 */
export async function deleteSubTask(subTaskId, builderId, companyId) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const ownerCheck = await client.query(
      `
      SELECT s.builder_id, s.company_id
      FROM job_process_subtask st
      JOIN job_process_task t ON t.job_process_task_id = st.job_process_task_id
      JOIN job_process_sub_stage ss ON ss.sub_stage_id = t.sub_stage_id
      JOIN job_process_stage s ON s.stage_id = ss.stage_id
      WHERE st.job_process_subtask_id = $1
      `,
      [subTaskId],
    );

    if (ownerCheck.rows.length === 0) {
      throw new Error("Sub-task not found");
    }

    const owner = ownerCheck.rows[0];
    if (owner.builder_id !== builderId && owner.company_id !== companyId) {
      throw new Error("You can only delete sub-tasks for your own tasks");
    }

    const checkQuery = await client.query(
      `
      SELECT job_process_subtask_id, job_process_task_id, sort_order
      FROM job_process_subtask
      WHERE job_process_subtask_id = $1
      `,
      [subTaskId],
    );

    if (checkQuery.rows.length === 0) {
      throw new Error("Sub-task not found");
    }

    const existingSortOrder = checkQuery.rows[0].sort_order;
    const taskId = checkQuery.rows[0].job_process_task_id;

    await client.query(
      `
      UPDATE job_process_subtask
      SET sort_order = sort_order - 1
      WHERE job_process_task_id = $1 
        AND sort_order > $2
      `,
      [taskId, existingSortOrder],
    );

    // Delete sub-task
    await client.query(
      `
      DELETE FROM job_process_subtask
      WHERE job_process_subtask_id = $1
      `,
      [subTaskId],
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * DELETE TASK DEPENDENCY
 */
export async function deleteTaskDependency(taskId, predecessorTaskId, builderId, companyId) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const ownerCheck = await client.query(
      `
      SELECT s.builder_id, s.company_id
      FROM job_process_task t
      JOIN job_process_sub_stage ss ON ss.sub_stage_id = t.sub_stage_id
      JOIN job_process_stage s ON s.stage_id = ss.stage_id
      WHERE t.job_process_task_id = $1
      `,
      [taskId],
    );

    if (ownerCheck.rows.length === 0) {
      throw new Error("Task not found");
    }

    const owner = ownerCheck.rows[0];
    if (owner.builder_id !== builderId && owner.company_id !== companyId) {
      throw new Error("You can only delete dependencies for your own tasks");
    }

    const dependencyCheck = await client.query(
      `
      SELECT task_id, predecessor_task_id
      FROM job_process_task_dependency
      WHERE task_id = $1 AND predecessor_task_id = $2
      `,
      [taskId, predecessorTaskId],
    );

    if (dependencyCheck.rows.length === 0) {
      throw new Error("Task dependency not found");
    }

    await client.query(
      `
      DELETE FROM job_process_task_dependency
      WHERE task_id = $1 AND predecessor_task_id = $2
      `,
      [taskId, predecessorTaskId],
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function getAllJobTasks(builderId, companyId) {
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
      t.created_at,
      t.updated_at,

      d.predecessor_task_id,
      pt.name AS predecessor_task_name,

      ss.sub_stage_id,
      ss.name AS sub_stage_name,
      ss.sort_order AS sub_stage_sort_order,

      s.stage_id,
      s.name AS stage_name,
      s.sort_order AS stage_sort_order,

      st.job_process_subtask_id,
      st.name AS subtask_name,
      st.sort_order AS subtask_order

    FROM job_process_task t
    JOIN job_process_sub_stage ss
      ON ss.sub_stage_id = t.sub_stage_id
    JOIN job_process_stage s
      ON s.stage_id = ss.stage_id
    LEFT JOIN job_process_task_dependency d
      ON d.task_id = t.job_process_task_id
    LEFT JOIN job_process_task pt
      ON pt.job_process_task_id = d.predecessor_task_id
    LEFT JOIN job_process_subtask st
      ON st.job_process_task_id = t.job_process_task_id
    WHERE s.builder_id = $1 
      AND s.company_id = $2
    ORDER BY s.sort_order, ss.sort_order, t.sort_order, st.sort_order
    `,
    [builderId, companyId],
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
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        predecessorTask: [],
        subStage: {
          subStageId: r.sub_stage_id,
          name: r.sub_stage_name,
          sortOrder: r.sub_stage_sort_order,
        },
        stage: {
          stageId: r.stage_id,
          name: r.stage_name,
          sortOrder: r.stage_sort_order,
        },
        subTasks: [],
      });
    }

    const task = taskMap.get(r.job_process_task_id);

    // Add predecessor task if it exists
    if (r.predecessor_task_id) {
      const exists = task.predecessorTask.find(
        (p) => p.id === r.predecessor_task_id,
      );

      if (!exists) {
        task.predecessorTask.push({
          id: r.predecessor_task_id,
          name: r.predecessor_task_name || "Unknown Task",
        });
      }
    }

    if (r.job_process_subtask_id) {
      task.subTasks.push({
        jobProcessSubtaskId: r.job_process_subtask_id,
        name: r.subtask_name,
        sortOrder: r.subtask_order,
      });
    }
  }

  return Array.from(taskMap.values());
}

/**
 * GET SUB-TASKS BY TASK
 */
export async function getSubTasks(taskId, builderId, companyId) {
  const pool = getPool();

  const { rows } = await pool.query(
    `
    SELECT 
      st.*,
      t.job_process_task_id,
      t.name AS task_name
    FROM job_process_subtask st
    JOIN job_process_task t ON t.job_process_task_id = st.job_process_task_id
    JOIN job_process_sub_stage ss ON ss.sub_stage_id = t.sub_stage_id
    JOIN job_process_stage s ON s.stage_id = ss.stage_id
    WHERE st.job_process_task_id = $1
      AND (s.builder_id = $2 OR s.company_id = $3)
    ORDER BY st.sort_order
    `,
    [taskId, builderId, companyId],
  );

  return rows.map((row) => ({
    jobProcessSubtaskId: row.job_process_subtask_id,
    name: row.name,
    sortOrder: row.sort_order,
    jobProcessTask: {
      id: row.job_process_task_id,
      name: row.task_name,
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

/**
 * GET ALL TASKS - TASK DETAILS ONLY
 */
export async function getAllTasksOnly(builderId, companyId) {
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
      t.created_at,
      t.updated_at,
      
      d.predecessor_task_id,
      pt.name AS predecessor_task_name

    FROM job_process_task t
    JOIN job_process_sub_stage ss ON ss.sub_stage_id = t.sub_stage_id
    JOIN job_process_stage s ON s.stage_id = ss.stage_id
    LEFT JOIN job_process_task_dependency d ON d.task_id = t.job_process_task_id
    LEFT JOIN job_process_task pt ON pt.job_process_task_id = d.predecessor_task_id
    WHERE s.builder_id = $1 
      AND s.company_id = $2
    ORDER BY t.sort_order
    `,
    [builderId, companyId],
  );

  const taskMap = new Map();

  for (const r of rows) {
    if (!taskMap.has(r.job_process_task_id)) {
      taskMap.set(r.job_process_task_id, {
        jobProcessTaskId: r.job_process_task_id,
        name: r.name,
        description: r.description,
        sortOrder: r.sort_order,
        noOfDays: r.no_of_days,
        assigneeId: r.assignee_id,
        notify: r.notify,
        milestone: r.milestone,
        attachmentMandatory: r.attachment_mandatory,
        predecessorTask: [],
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      });
    }

    const task = taskMap.get(r.job_process_task_id);

    if (r.predecessor_task_id) {
      const exists = task.predecessorTask.some(
        (p) => p.id === r.predecessor_task_id,
      );

      if (!exists) {
        task.predecessorTask.push({
          id: r.predecessor_task_id,
          name: r.predecessor_task_name || "Unknown Task",
        });
      }
    }
  }

  return Array.from(taskMap.values());
}
