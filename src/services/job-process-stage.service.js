const getPool = require("../config/database");
const {
  ensureWorkflowStageByStageId,
} = require("./job-process-workflow.guard");

/**
 * CREATE STAGE
 */
async function createStage(companyId, builderId, payload) {
  const pool = getPool();

  // Check for duplicate stage name within same company/builder
  const duplicateCheck = await pool.query(
    `
    SELECT stage_id 
    FROM job_process_stage
    WHERE company_id = $1 
      AND builder_id = $2 
      AND name = $3
    `,
    [companyId, builderId, payload.name]
  );

  if (duplicateCheck.rows.length > 0) {
    throw new Error(`Stage with name ${payload.name} already exists for this company/builder`);
  }

  // Get max sort_order for existing stages to shift
  const maxSortOrderQuery = `
    SELECT COALESCE(MAX(sort_order), 0) AS max_sort_order
    FROM job_process_stage
    WHERE company_id = $1 
      AND builder_id = $2
  `;
  const maxSortOrderResult = await pool.query(maxSortOrderQuery, [companyId, builderId]);
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

  // If sort_order is provided, shift all stages >= provided sort_order
  if (payload.sort_order !== undefined) {
    const shiftSortOrderQuery = `
      UPDATE job_process_stage
      SET sort_order = sort_order + 1
      WHERE company_id = $1 
        AND builder_id = $2 
        AND sort_order >= $3
    `;
    await pool.query(shiftSortOrderQuery, [companyId, builderId, payload.sort_order]);
  }

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
      finalSortOrder,
      payload.dependent_stage_id || null,
    ]
  );

  // Fetch the created stage with dependent stage name
  const { rows: createdRows } = await pool.query(
    `
    SELECT 
      s.*,
      ds.name AS dependent_stage_name,
      f.functionality_id,
      f.name AS functionality_name
    FROM job_process_stage s
    LEFT JOIN job_process_stage ds ON s.dependent_stage_id = ds.stage_id
    JOIN job_process_stage_functionality f ON f.functionality_id = s.functionality_id
    WHERE s.stage_id = $1
    `,
    [result.rows[0].stage_id]
  );

  const stageData = createdRows[0];
  return {
    stageId: stageData.stage_id,
    name: stageData.name,
    sortOrder: stageData.sort_order,
    dependentStage: stageData.dependent_stage_id ? {
      id: stageData.dependent_stage_id,
      name: stageData.dependent_stage_name
    } : null,
    functionality: {
      id: stageData.functionality_id,
      name: stageData.functionality_name,
      isWorkflow: stageData.is_workflow,
    },
    companyId: stageData.company_id,
    builderId: stageData.builder_id,
    createdAt: stageData.created_at,
    updatedAt: stageData.updated_at
  };
}

/**
 * UPDATE STAGE
 */
async function updateStage(stageId, payload, builderId, companyId) {
  console.log("🚀 ~ updateStage ~ stageId, payload, builderId, companyId:", stageId, payload, builderId, companyId)
  const pool = getPool();

  // Check if stage exists and belongs to builder
  const checkQuery = await pool.query(
    `
    SELECT stage_id, builder_id, company_id, name, sort_order
    FROM job_process_stage
    WHERE stage_id = $1 AND builder_id = $2 AND company_id = $3
    `,
    [stageId, builderId, companyId]
  );

  console.log("🚀 ~ updateStage ~ checkQuery.rows:", checkQuery.rows)
  if (checkQuery.rows.length === 0) {
    throw new Error("Stage not found");
  }

  const existingStage = checkQuery.rows[0];

  // Check for duplicate name (excluding current stage)
  if (payload.name && payload.name !== existingStage.name) {
    const duplicateCheck = await pool.query(
      `
      SELECT stage_id 
      FROM job_process_stage
      WHERE company_id = $1 
        AND builder_id = $2 
        AND name = $3
        AND stage_id != $4
      `,
      [existingStage.company_id, existingStage.builder_id, payload.name, stageId]
    );

    if (duplicateCheck.rows.length > 0) {
      throw new Error(`Stage with name ${payload.name} already exists for this company/builder`);
    }
  }

  // Handle sort order shifting if sort_order is being updated
  if (payload.sort_order !== undefined && payload.sort_order !== existingStage.sort_order) {
    const maxSortOrderQuery = `
      SELECT COALESCE(MAX(sort_order), 0) AS max_sort_order
      FROM job_process_stage
      WHERE company_id = $1 
        AND builder_id = $2
    `;
    const maxSortOrderResult = await pool.query(maxSortOrderQuery, [existingStage.company_id, existingStage.builder_id]);
    const maxSortOrder = maxSortOrderResult.rows[0].max_sort_order;

    // Validate sort order range
    if (payload.sort_order < 1 || payload.sort_order > maxSortOrder + 1) {
      throw new Error(`Invalid sort_order. Allowed range is 1 to ${maxSortOrder + 1}.`);
    }

    // Shift sort orders based on movement direction
    if (payload.sort_order > existingStage.sort_order) {
      // Moving down: decrement sort_order for stages between old and new position
      await pool.query(
        `
        UPDATE job_process_stage
        SET sort_order = sort_order - 1
        WHERE sort_order > $1
          AND sort_order <= $2
          AND stage_id != $3
          AND builder_id = $4
        `,
        [existingStage.sort_order, payload.sort_order, stageId, existingStage.builder_id]
      );
    } else {
      // Moving up: increment sort_order for stages between new and old position
      await pool.query(
        `
        UPDATE job_process_stage
        SET sort_order = sort_order + 1
        WHERE sort_order >= $1
          AND sort_order < $2
          AND stage_id != $3
          AND builder_id = $4
        `,
        [payload.sort_order, existingStage.sort_order, stageId, existingStage.builder_id]
      );
    }
  }

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

  // Fetch the updated stage with dependent stage name
  const { rows: updatedRows } = await pool.query(
    `
    SELECT 
      s.*,
      ds.name AS dependent_stage_name,
      f.functionality_id,
      f.name AS functionality_name
    FROM job_process_stage s
    LEFT JOIN job_process_stage ds ON s.dependent_stage_id = ds.stage_id
    JOIN job_process_stage_functionality f ON f.functionality_id = s.functionality_id
    WHERE s.stage_id = $1
    `,
    [stageId]
  );

  const stageData = updatedRows[0];
  return {
    stageId: stageData.stage_id,
    name: stageData.name,
    sortOrder: stageData.sort_order,
    dependentStage: stageData.dependent_stage_id ? {
      id: stageData.dependent_stage_id,
      name: stageData.dependent_stage_name
    } : null,
    functionality: {
      id: stageData.functionality_id,
      name: stageData.functionality_name,
      isWorkflow: stageData.is_workflow,
    },
    companyId: stageData.company_id,
    builderId: stageData.builder_id,
    createdAt: stageData.created_at,
    updatedAt: stageData.updated_at
  };
}

/**
 * DELETE STAGE
 */
async function deleteStage(stageId, builderId) {
  const pool = getPool();
  
  // Check if stage belongs to the builder before deleting
  const checkQuery = await pool.query(
    `
    SELECT stage_id, builder_id, sort_order
    FROM job_process_stage
    WHERE stage_id = $1
    `,
    [stageId]
  );

  if (checkQuery.rows.length === 0) {
    throw new Error("Stage not found");
  }

  const stageBuilderId = checkQuery.rows[0].builder_id;
  if (stageBuilderId !== builderId) {
    throw new Error("You can only delete your own stages");
  }

  const existingSortOrder = checkQuery.rows[0].sort_order;

  // Shift sort order: decrement sort_order for all stages > deleted stage
  await pool.query(
    `
    UPDATE job_process_stage
    SET sort_order = sort_order - 1
    WHERE builder_id = $1 
      AND sort_order > $2
    `,
    [builderId, existingSortOrder]
  );

  await pool.query(`DELETE FROM job_process_stage WHERE stage_id = $1`, [
    stageId,
  ]);
}

/**
 * CREATE SUB STAGE (workflow only)
 */
async function createSubStage(stageId, payload) {
  await ensureWorkflowStageByStageId(stageId);

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Get parent stage info to retrieve company and builder IDs
    const stageQuery = await client.query(
      `
      SELECT company_id, builder_id
      FROM job_process_stage
      WHERE stage_id = $1
      `,
      [stageId]
    );

    if (stageQuery.rows.length === 0) {
      throw new Error("Parent stage not found");
    }

    const { company_id: companyId, builder_id: builderId } = stageQuery.rows[0];

    // Check for duplicate sub-stage name within the same stage
    const duplicateCheck = await client.query(
      `
      SELECT sub_stage_id 
      FROM job_process_sub_stage
      WHERE stage_id = $1 
        AND name = $2
      `,
      [stageId, payload.name]
    );

    if (duplicateCheck.rows.length > 0) {
      throw new Error(`Sub-stage with name ${payload.name} already exists for this stage`);
    }

    // Get max sort_order for existing sub-stages to shift
    const maxSortOrderQuery = `
      SELECT COALESCE(MAX(sort_order), 0) AS max_sort_order
      FROM job_process_sub_stage
      WHERE stage_id = $1
    `;
    const maxSortOrderResult = await client.query(maxSortOrderQuery, [stageId]);
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

    // If sort_order is provided, shift all sub-stages >= provided sort_order
    if (payload.sort_order !== undefined) {
      const shiftSortOrderQuery = `
        UPDATE job_process_sub_stage
        SET sort_order = sort_order + 1
        WHERE stage_id = $1 
          AND sort_order >= $2
      `;
      await client.query(shiftSortOrderQuery, [stageId, payload.sort_order]);
    }

    const result = await client.query(
      `
      INSERT INTO job_process_sub_stage
      (stage_id, name, sort_order)
      VALUES ($1, $2, $3)
      RETURNING *
      `,
      [
        stageId,
        payload.name,
        finalSortOrder
      ]
    );

    await client.query("COMMIT");
    return result.rows[0];
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

async function updateSubStage(subStageId, payload, builderId, companyId) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const checkQuery = await client.query(
      `
      SELECT ss.sub_stage_id, ss.stage_id, ss.name, ss.sort_order, s.builder_id, s.company_id
      FROM job_process_sub_stage ss
      JOIN job_process_stage s ON s.stage_id = ss.stage_id
      WHERE ss.sub_stage_id = $1
      `,
      [subStageId]
    );

    if (checkQuery.rows.length === 0) {
      throw new Error("Sub-stage not found");
    }

    const existingSubStage = checkQuery.rows[0];

    if (existingSubStage.builder_id !== builderId && existingSubStage.company_id !== companyId) {
      throw new Error("You can only update your own sub-stages");
    }

    if (payload.name && payload.name !== existingSubStage.name) {
      const duplicateCheck = await client.query(
        `
        SELECT sub_stage_id 
        FROM job_process_sub_stage
        WHERE stage_id = $1 
          AND name = $2
          AND sub_stage_id != $3
        `,
        [existingSubStage.stage_id, payload.name, subStageId]
      );

      if (duplicateCheck.rows.length > 0) {
        throw new Error(`Sub-stage with name ${payload.name} already exists for this stage`);
      }
    }

    if (payload.sort_order !== undefined && payload.sort_order !== existingSubStage.sort_order) {
      const maxSortOrderQuery = `
        SELECT COALESCE(MAX(sort_order), 0) AS max_sort_order
        FROM job_process_sub_stage
        WHERE stage_id = $1
      `;
      const maxSortOrderResult = await client.query(maxSortOrderQuery, [existingSubStage.stage_id]);
      const maxSortOrder = maxSortOrderResult.rows[0].max_sort_order;

      if (payload.sort_order < 1 || payload.sort_order > maxSortOrder + 1) {
        throw new Error(`Invalid sort_order. Allowed range is 1 to ${maxSortOrder + 1}.`);
      }

      if (payload.sort_order > existingSubStage.sort_order) {
        await client.query(
          `
          UPDATE job_process_sub_stage
          SET sort_order = sort_order - 1
          WHERE sort_order > $1
            AND sort_order <= $2
            AND sub_stage_id != $3
            AND stage_id = $4
          `,
          [existingSubStage.sort_order, payload.sort_order, subStageId, existingSubStage.stage_id]
        );
      } else {
        await client.query(
          `
          UPDATE job_process_sub_stage
          SET sort_order = sort_order + 1
          WHERE sort_order >= $1
            AND sort_order < $2
            AND sub_stage_id != $3
            AND stage_id = $4
          `,
          [payload.sort_order, existingSubStage.sort_order, subStageId, existingSubStage.stage_id]
        );
      }
    }

    const { rows, rowCount } = await client.query(
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

    await client.query("COMMIT");
    return rows[0];
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

async function deleteSubStage(subStageId, builderId, companyId) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const checkQuery = await client.query(
      `
      SELECT ss.sub_stage_id, ss.stage_id, ss.sort_order, s.builder_id, s.company_id
      FROM job_process_sub_stage ss
      JOIN job_process_stage s ON s.stage_id = ss.stage_id
      WHERE ss.sub_stage_id = $1
      `,
      [subStageId]
    );

    if (checkQuery.rows.length === 0) {
      throw new Error("Sub-stage not found");
    }

    const subStageInfo = checkQuery.rows[0];

    if (subStageInfo.builder_id !== builderId && subStageInfo.company_id !== companyId) {
      throw new Error("You can only delete your own sub-stages");
    }

    const existingSortOrder = subStageInfo.sort_order;
    const stageId = subStageInfo.stage_id;

    await client.query(
      `
      UPDATE job_process_sub_stage
      SET sort_order = sort_order - 1
      WHERE stage_id = $1 
        AND sort_order > $2
      `,
      [stageId, existingSortOrder]
    );

    await client.query(
      `DELETE FROM job_process_sub_stage WHERE sub_stage_id = $1`,
      [subStageId]
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

async function getJobProcess(companyId, builderId) {
  const pool = getPool();

  const { rows } = await pool.query(
    `
    SELECT
      s.stage_id,
      s.name AS stage_name,
      s.sort_order AS stage_order,
      s.dependent_stage_id,
      ds.name AS dependent_stage_name,
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
      pt.name AS predecessor_task_name,

      st.job_process_subtask_id,
      st.name AS subtask_name,
      st.sort_order AS subtask_order

    FROM job_process_stage s
    JOIN job_process_stage_functionality f ON f.functionality_id = s.functionality_id
    LEFT JOIN job_process_stage ds ON s.dependent_stage_id = ds.stage_id
    LEFT JOIN job_process_sub_stage ss ON ss.stage_id = s.stage_id
    LEFT JOIN job_process_task t ON t.sub_stage_id = ss.sub_stage_id
    LEFT JOIN job_process_task_dependency d ON d.task_id = t.job_process_task_id
    LEFT JOIN job_process_task pt ON d.predecessor_task_id = pt.job_process_task_id
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
        dependentStage: r.dependent_stage_id ? {
          id: r.dependent_stage_id,
          name: r.dependent_stage_name
        } : null,
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
          !task.dependencies.find(dep => dep.id === r.predecessor_task_id)
        ) {
          task.dependencies.push({
            id: r.predecessor_task_id,
            name: r.predecessor_task_name
          });
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
      ds.name AS dependent_stage_name,
      f.functionality_id,
      f.name AS functionality_name
    FROM job_process_stage s
    JOIN job_process_stage_functionality f
      ON f.functionality_id = s.functionality_id
    LEFT JOIN job_process_stage ds ON s.dependent_stage_id = ds.stage_id
    WHERE s.company_id = $1
      AND s.builder_id = $2
    ORDER BY s.sort_order
    `,
    [companyId, builderId]
  );

  // Format response to include dependentStage as object
  return rows.map(row => ({
    stageId: row.stage_id,
    name: row.name,
    sortOrder: row.sort_order,
    dependentStage: row.dependent_stage_id ? {
      id: row.dependent_stage_id,
      name: row.dependent_stage_name
    } : null,
    functionality: {
      id: row.functionality_id,
      name: row.functionality_name,
    }
  }));
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
  createSubStage,
  updateSubStage,
  deleteSubStage,
  getStages,
  getSubStages,
  getStageFunctionalities,
  getJobProcess,
};
