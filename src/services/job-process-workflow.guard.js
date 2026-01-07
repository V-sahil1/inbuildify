const getPool = require("../config/database");

async function ensureWorkflowStageByStageId(stageId) {
  const pool = getPool();
  const { rows } = await pool.query(
    `
    SELECT f.is_workflow
    FROM job_process_stage s
    JOIN job_process_stage_functionality f
      ON f.functionality_id = s.functionality_id
    WHERE s.stage_id = $1
    `,
    [stageId]
  );

  if (!rows[0]?.is_workflow) {
    throw new Error("Operation allowed only for workflow stages");
  }
}

async function ensureWorkflowStageBySubStageId(subStageId) {
  const pool = getPool();
  const { rows } = await pool.query(
    `
    SELECT f.is_workflow
    FROM job_process_sub_stage ss
    JOIN job_process_stage s ON s.stage_id = ss.stage_id
    JOIN job_process_stage_functionality f ON f.functionality_id = s.functionality_id
    WHERE ss.sub_stage_id = $1
    `,
    [subStageId]
  );

  // if (!rows[0]?.is_workflow) {
  //   throw new Error("Tasks allowed only under workflow stages");
  // }
}

module.exports = {
  ensureWorkflowStageByStageId,
  ensureWorkflowStageBySubStageId,
};
