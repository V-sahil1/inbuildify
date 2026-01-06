const getPool = require("../config/database");
const {
  ensureWorkflowStageByStageId,
} = require("./job-process-workflow.guard");

/**
 * CREATE STAGE
 */
async function createStage(companyId, builderId, payload) {
  const pool = getPool();

  const result = await pool.query(
    `
    INSERT INTO job_process_stage
    (company_id, builder_id, name, functionality_id, sort_order, dependent_stage_id)
    VALUES ($1,$2,$3,$4,$5,$6)
    RETURNING *
    `,
    [
      companyId,
      builderId,
      payload.name,
      payload.functionality_id,
      payload.sort_order,
      payload.dependent_stage_id || null,
    ]
  );

  return result.rows[0];
}

/**
 * UPDATE STAGE
 */
async function updateStage(stageId, payload) {
  const pool = getPool();

  const result = await pool.query(
    `
    UPDATE job_process_stage
    SET
      name = COALESCE($2, name),
      sort_order = COALESCE($3, sort_order),
      dependent_stage_id = COALESCE($4, dependent_stage_id),
      updated_at = NOW()
    WHERE stage_id = $1
    RETURNING *
    `,
    [stageId, payload.name, payload.sort_order, payload.dependent_stage_id]
  );

  if (!result.rowCount) {
    throw new Error("Stage not found");
  }

  return result.rows[0];
}

/**
 * DELETE STAGE
 */
async function deleteStage(stageId) {
  const pool = getPool();
  await pool.query(`DELETE FROM job_process_stage WHERE stage_id = $1`, [
    stageId,
  ]);
}

/**
 * CREATE SUB STAGE (workflow only)
 */
exports.createSubStage = async (stageId, payload) => {
  await ensureWorkflowStageByStageId(stageId);

  const pool = getPool();
  const { rows } = await pool.query(
    `
    INSERT INTO job_process_sub_stage(stage_id, name, sort_order)
    VALUES ($1,$2,$3)
    RETURNING *
    `,
    [stageId, payload.name, payload.sort_order]
  );
  return rows[0];
};

exports.updateSubStage = async (subStageId, payload) => {
  const pool = getPool();
  const { rows, rowCount } = await pool.query(
    `
    UPDATE job_process_sub_stage
    SET
      name = COALESCE($2, name),
      sort_order = COALESCE($3, sort_order),
      updated_at = NOW()
    WHERE sub_stage_id = $1
    RETURNING *
    `,
    [subStageId, payload.name, payload.sort_order]
  );

  if (!rowCount) throw new Error("Sub-stage not found");
  return rows[0];
};

exports.deleteSubStage = async (subStageId) => {
  const pool = getPool();
  await pool.query(
    `DELETE FROM job_process_sub_stage WHERE sub_stage_id = $1`,
    [subStageId]
  );
};

async function getJobProcess(companyId, builderId) {
  const pool = getPool();

  const { rows } = await pool.query(
    `
    SELECT
      s.stage_id,
      s.name AS stage_name,
      s.sort_order AS stage_order,
      f.functionality_id,
      f.name AS functionality_name,
      f.is_workflow,

      ss.sub_stage_id,
      ss.name AS sub_stage_name,
      ss.sort_order AS sub_stage_order,

      t.job_process_task_id,
      t.name AS task_name,
      t.sort_order AS task_order,

      d.predecessor_task_id,

      st.job_process_subtask_id,
      st.name AS subtask_name,
      st.sort_order AS subtask_order

    FROM job_process_stage s
    JOIN job_process_stage_functionality f ON f.functionality_id = s.functionality_id
    LEFT JOIN job_process_sub_stage ss ON ss.stage_id = s.stage_id
    LEFT JOIN job_process_task t ON t.sub_stage_id = ss.sub_stage_id
    LEFT JOIN job_process_task_dependency d ON d.task_id = t.job_process_task_id
    LEFT JOIN job_process_subtask st ON st.job_process_task_id = t.job_process_task_id
    WHERE s.company_id = $1 AND s.builder_id = $2
    ORDER BY
      s.sort_order,
      ss.sort_order,
      t.sort_order,
      st.sort_order
  `,
    [companyId, builderId]
  );

  const stageMap = new Map();

  for (const r of rows) {
    if (!stageMap.has(r.stage_id)) {
      stageMap.set(r.stage_id, {
        stageId: r.stage_id,
        name: r.stage_name,
        sortOrder: r.stage_order,
        functionality: {
          id: r.functionality_id,
          name: r.functionality_name,
          isWorkflow: r.is_workflow,
        },
        subStages: [],
      });
    }

    const stage = stageMap.get(r.stage_id);

    if (r.sub_stage_id) {
      let subStage = stage.subStages.find(
        (s) => s.subStageId === r.sub_stage_id
      );

      if (!subStage) {
        subStage = {
          subStageId: r.sub_stage_id,
          name: r.sub_stage_name,
          sortOrder: r.sub_stage_order,
          tasks: [],
        };
        stage.subStages.push(subStage);
      }

      if (r.job_process_task_id) {
        let task = subStage.tasks.find(
          (t) => t.taskId === r.job_process_task_id
        );

        if (!task) {
          task = {
            taskId: r.job_process_task_id,
            name: r.task_name,
            sortOrder: r.task_order,
            dependencies: [],
            subTasks: [],
          };
          subStage.tasks.push(task);
        }

        if (
          r.predecessor_task_id &&
          !task.dependencies.includes(r.predecessor_task_id)
        ) {
          task.dependencies.push(r.predecessor_task_id);
        }

        if (r.job_process_subtask_id) {
          if (
            !task.subTasks.find(
              (st) => st.subTaskId === r.job_process_subtask_id
            )
          ) {
            task.subTasks.push({
              subTaskId: r.job_process_subtask_id,
              name: r.subtask_name,
              sortOrder: r.subtask_order,
            });
          }
        }
      }
    }
  }

  return Array.from(stageMap.values());
}

async function getStages(companyId, builderId) {
  const pool = getPool();

  const { rows } = await pool.query(
    `
    SELECT
      s.stage_id,
      s.name,
      s.sort_order,
      s.dependent_stage_id,
      f.functionality_id,
      f.name AS functionality_name,
      f.is_workflow
    FROM job_process_stage s
    JOIN job_process_stage_functionality f
      ON f.functionality_id = s.functionality_id
    WHERE s.company_id = $1
      AND s.builder_id = $2
    ORDER BY s.sort_order
    `,
    [companyId, builderId]
  );

  return rows;
}

async function getSubStages(stageId) {
  const pool = getPool();

  const workflowCheck = await pool.query(
    `
    SELECT f.is_workflow
    FROM job_process_stage s
    JOIN job_process_stage_functionality f
      ON f.functionality_id = s.functionality_id
    WHERE s.stage_id = $1
    `,
    [stageId]
  );

  if (!workflowCheck.rows[0]?.is_workflow) {
    throw new Error("Sub-stages allowed only for workflow stages");
  }

  const { rows } = await pool.query(
    `
    SELECT
      sub_stage_id,
      name,
      sort_order
    FROM job_process_sub_stage
    WHERE stage_id = $1
    ORDER BY sort_order
    `,
    [stageId]
  );

  return rows;
}

async function getStageFunctionalities() {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT * FROM job_process_stage_functionality ORDER BY name`
  );
  return rows;
}

module.exports = {
  createStage,
  updateStage,
  deleteStage,
  getStages,
  getSubStages,
  getStageFunctionalities,
  getJobProcess,
};
