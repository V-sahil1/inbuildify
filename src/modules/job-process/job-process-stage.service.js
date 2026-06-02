import db from "../../config/database/models/postgre-models/index.js";
import { ensureWorkflowStageByStageId } from "./job-process-workflow.guard.js";
import { Sequelize } from "sequelize";

const { Op } = Sequelize;

/**
 * CREATE STAGE
 */
export async function createStage(companyId, builderId, payload) {
  const { JobProcessStage, JobProcessStageFunctionality } = db;

  return await db.sequelize.transaction(async (t) => {
    // 1. Duplicate check
    const existing = await JobProcessStage.findOne({
      where: {
        company_id: companyId,
        builder_id: builderId,
        name: payload.name,
      },
      transaction: t,
    });

    if (existing) {
      throw new Error(`Stage with name ${payload.name} already exists for this company/builder`);
    }

    // 2. Sort Order Logic
    const maxSortOrder = (await JobProcessStage.max("sort_order", {
      where: { company_id: companyId, builder_id: builderId },
      transaction: t,
    })) || 0;

    let finalSortOrder;
    if (payload.sort_order !== undefined) {
      finalSortOrder = payload.sort_order;
    } else {
      finalSortOrder = maxSortOrder + 1;
    }

    if (finalSortOrder < 1 || finalSortOrder > maxSortOrder + 1) {
      throw new Error(`Invalid sort_order. Allowed range is 1 to ${maxSortOrder + 1}.`);
    }

    // Shift existing stages if sort_order is provided
    if (payload.sort_order !== undefined) {
      await JobProcessStage.increment("sort_order", {
        by: 1,
        where: {
          company_id: companyId,
          builder_id: builderId,
          sort_order: { [Op.gte]: payload.sort_order },
        },
        transaction: t,
      });
    }

    // 3. Create Stage
    const stage = await JobProcessStage.create({
      company_id: companyId,
      builder_id: builderId,
      name: payload.name,
      functionality_id: payload.functionality_id,
      sort_order: finalSortOrder,
      dependent_stage_id: payload.dependent_stage_id || null,
    }, { transaction: t });

    // 4. Fetch with relations for consistent response
    const stageData = await JobProcessStage.findByPk(stage.stage_id, {
      include: [
        { model: JobProcessStage, as: "dependentStage", attributes: ["stage_id", "name"] },
        { model: JobProcessStageFunctionality, as: "functionality", attributes: ["functionality_id", "name", "is_workflow"] },
      ],
      transaction: t,
    });

    const plain = stageData.get({ plain: true });

    return {
      stageId: plain.stage_id,
      name: plain.name,
      sortOrder: plain.sort_order,
      dependentStage: plain.dependentStage
        ? { id: plain.dependentStage.stage_id, name: plain.dependentStage.name }
        : null,
      functionality: {
        id: plain.functionality.functionality_id,
        name: plain.functionality.name,
      },
      isWorkflow: plain.functionality.is_workflow,
      companyId: plain.company_id,
      builderId: plain.builder_id,
      createdAt: plain.created_at,
      updatedAt: plain.updated_at,
    };
  });
}

/**
 * UPDATE STAGE
 */
export async function updateStage(stageId, payload, builderId, companyId) {
  const { JobProcessStage, JobProcessStageFunctionality } = db;

  return await db.sequelize.transaction(async (t) => {
    const stage = await JobProcessStage.findOne({
      where: { stage_id: stageId, builder_id: builderId, company_id: companyId },
      transaction: t,
    });

    if (!stage) {
      throw new Error("Stage not found");
    }

    // Duplicate check for name change
    if (payload.name && payload.name !== stage.name) {
      const duplicate = await JobProcessStage.findOne({
        where: {
          company_id: companyId,
          builder_id: builderId,
          name: payload.name,
          stage_id: { [Op.ne]: stageId },
        },
        transaction: t,
      });

      if (duplicate) {
        throw new Error(`Stage with name ${payload.name} already exists for this company/builder`);
      }
    }

    // Sort order rebalancing
    if (payload.sort_order !== undefined && payload.sort_order !== stage.sort_order) {
      const maxSortOrder = await JobProcessStage.max("sort_order", {
        where: { company_id: companyId, builder_id: builderId },
        transaction: t,
      });

      if (payload.sort_order < 1 || payload.sort_order > maxSortOrder) {
        throw new Error(`Invalid sort_order. Allowed range is 1 to ${maxSortOrder}.`);
      }

      const oldOrder = stage.sort_order;
      const newOrder = payload.sort_order;

      if (newOrder > oldOrder) {
        // Shift intermediate stages down
        await JobProcessStage.decrement("sort_order", {
          by: 1,
          where: {
            builder_id: builderId,
            company_id: companyId,
            sort_order: { [Op.gt]: oldOrder, [Op.lte]: newOrder },
            stage_id: { [Op.ne]: stageId },
          },
          transaction: t,
        });
      } else {
        // Shift intermediate stages up
        await JobProcessStage.increment("sort_order", {
          by: 1,
          where: {
            builder_id: builderId,
            company_id: companyId,
            sort_order: { [Op.lt]: oldOrder, [Op.gte]: newOrder },
            stage_id: { [Op.ne]: stageId },
          },
          transaction: t,
        });
      }
    }

    // Update Stage
    await stage.update({
      name: payload.name,
      sort_order: payload.sort_order,
      dependent_stage_id: payload.dependent_stage_id,
      functionality_id: payload.functionality_id,
      updated_at: new Date(),
    }, { transaction: t });

    // Fetch refreshed data
    const stageData = await JobProcessStage.findByPk(stageId, {
      include: [
        { model: JobProcessStage, as: "dependentStage", attributes: ["stage_id", "name"] },
        { model: JobProcessStageFunctionality, as: "functionality", attributes: ["functionality_id", "name", "is_workflow"] },
      ],
      transaction: t,
    });

    const plain = stageData.get({ plain: true });

    return {
      stageId: plain.stage_id,
      name: plain.name,
      sortOrder: plain.sort_order,
      dependentStage: plain.dependentStage
        ? { id: plain.dependentStage.stage_id, name: plain.dependentStage.name }
        : null,
      functionality: {
        id: plain.functionality.functionality_id,
        name: plain.functionality.name,
      },
      isWorkflow: plain.functionality.is_workflow,
      companyId: plain.company_id,
      builderId: plain.builder_id,
      updatedAt: plain.updated_at,
    };
  });
}

/**
 * DELETE STAGE
 */
export async function deleteStage(stageId, builderId, companyId) {
  const { JobProcessStage } = db;

  return await db.sequelize.transaction(async (t) => {
    const stage = await JobProcessStage.findOne({
      where: { stage_id: stageId, builder_id: builderId, company_id: companyId },
      transaction: t,
    });

    if (!stage) {
      throw new Error("Stage not found");
    }

    const deletedOrder = stage.sort_order;

    await stage.destroy({ transaction: t });

    // Rebalance sort orders for subsequent stages
    await JobProcessStage.decrement("sort_order", {
      by: 1,
      where: {
        company_id: companyId,
        builder_id: builderId,
        sort_order: { [Op.gt]: deletedOrder },
      },
      transaction: t,
    });
  });
}

export async function createSubStage(stageId, payload) {
  await ensureWorkflowStageByStageId(stageId);

  const { JobProcessStage, JobProcessSubStage } = db;

  return await db.sequelize.transaction(async (t) => {
    const parentStage = await JobProcessStage.findByPk(stageId, { transaction: t });
    if (!parentStage) {
      throw new Error("Parent stage not found");
    }

    // Duplicate check
    const existing = await JobProcessSubStage.findOne({
      where: { stage_id: stageId, name: payload.name },
      transaction: t,
    });

    if (existing) {
      throw new Error(`Sub-stage with name ${payload.name} already exists for this stage`);
    }

    // Sort order rebalancing
    const maxSortOrder = (await JobProcessSubStage.max("sort_order", {
      where: { stage_id: stageId },
      transaction: t,
    })) || 0;

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
      await JobProcessSubStage.increment("sort_order", {
        by: 1,
        where: {
          stage_id: stageId,
          sort_order: { [Op.gte]: payload.sort_order },
        },
        transaction: t,
      });
    }

    const subStage = await JobProcessSubStage.create({
      stage_id: stageId,
      name: payload.name,
      sort_order: finalSortOrder,
    }, { transaction: t });

    return subStage.get({ plain: true });
  });
}

export async function updateSubStage(subStageId, payload, builderId, companyId) {
  const { JobProcessSubStage, JobProcessStage } = db;

  return await db.sequelize.transaction(async (t) => {
    const subStage = await JobProcessSubStage.findOne({
      where: { sub_stage_id: subStageId },
      include: [{
        model: JobProcessStage,
        as: "stage",
        where: { builder_id: builderId, company_id: companyId },
      }],
      transaction: t,
    });

    if (!subStage) {
      throw new Error("Sub-stage not found");
    }

    // Duplicate check
    if (payload.name && payload.name !== subStage.name) {
      const duplicate = await JobProcessSubStage.findOne({
        where: {
          stage_id: subStage.stage_id,
          name: payload.name,
          sub_stage_id: { [Op.ne]: subStageId },
        },
        transaction: t,
      });

      if (duplicate) {
        throw new Error(`Sub-stage with name ${payload.name} already exists for this stage`);
      }
    }

    // Sort order rebalancing
    if (payload.sort_order !== undefined && payload.sort_order !== subStage.sort_order) {
      const maxSortOrder = await JobProcessSubStage.max("sort_order", {
        where: { stage_id: subStage.stage_id },
        transaction: t,
      });

      if (payload.sort_order < 1 || payload.sort_order > maxSortOrder) {
        throw new Error(`Invalid sort_order. Allowed range is 1 to ${maxSortOrder}.`);
      }

      const oldOrder = subStage.sort_order;
      const newOrder = payload.sort_order;

      if (newOrder > oldOrder) {
        await JobProcessSubStage.decrement("sort_order", {
          by: 1,
          where: {
            stage_id: subStage.stage_id,
            sort_order: { [Op.gt]: oldOrder, [Op.lte]: newOrder },
            sub_stage_id: { [Op.ne]: subStageId },
          },
          transaction: t,
        });
      } else {
        await JobProcessSubStage.increment("sort_order", {
          by: 1,
          where: {
            stage_id: subStage.stage_id,
            sort_order: { [Op.lt]: oldOrder, [Op.gte]: newOrder },
            sub_stage_id: { [Op.ne]: subStageId },
          },
          transaction: t,
        });
      }
    }

    await subStage.update({
      name: payload.name,
      sort_order: payload.sort_order,
      updated_at: new Date(),
    }, { transaction: t });

    return subStage.get({ plain: true });
  });
}

export async function deleteSubStage(subStageId, builderId, companyId, taskId = null) {
  const { JobProcessSubStage, JobProcessStage, JobProcessTask } = db;

  return await db.sequelize.transaction(async (t) => {
    const subStage = await JobProcessSubStage.findOne({
      where: { sub_stage_id: subStageId },
      include: [{
        model: JobProcessStage,
        as: "stage",
        where: { builder_id: builderId, company_id: companyId },
      }],
      transaction: t,
    });

    if (!subStage) {
      throw new Error("Sub-stage not found");
    }

    const existingSortOrder = subStage.sort_order;
    const stageId = subStage.stage_id;

    // Fetch tasks in this sub-stage
    const tasks = await JobProcessTask.findAll({
      where: { sub_stage_id: subStageId },
      order: [["sort_order", "ASC"]],
      transaction: t,
    });

    if (taskId) {
      // Logic for moving tasks to a specific task's parent sub-stage
      const targetTask = await JobProcessTask.findByPk(taskId, { transaction: t });
      if (!targetTask) {
        throw new Error("Task not found");
      }

      const targetSubStageId = targetTask.sub_stage_id;
      const targetTaskSortOrder = targetTask.sort_order;

      // Shift target sub-stage tasks to make room
      await JobProcessTask.increment("sort_order", {
        by: tasks.length,
        where: {
          sub_stage_id: targetSubStageId,
          sort_order: { [Op.gt]: targetTaskSortOrder },
        },
        transaction: t,
      });

      // Move tasks to target sub-stage
      for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];
        await task.update({
          sub_stage_id: targetSubStageId,
          sort_order: targetTaskSortOrder + 1 + i,
        }, { transaction: t });
      }
    } else {
      // General relocation to the next sub-stage
      await handleAllTaskRelocation(t, subStageId, stageId, existingSortOrder);
    }

    // Shift remaining sub-stages
    await JobProcessSubStage.decrement("sort_order", {
      by: 1,
      where: {
        stage_id: stageId,
        sort_order: { [Op.gt]: existingSortOrder },
      },
      transaction: t,
    });

    await subStage.destroy({ transaction: t });
  });
}

async function handleAllTaskRelocation(
  transaction,
  deletedSubStageId,
  stageId,
  deletedSortOrder,
  specificTasks = null,
) {
  const { JobProcessSubStage, JobProcessTask } = db;

  let targetSubStage;

  if (specificTasks) {
    targetSubStage = await JobProcessSubStage.findOne({
      where: {
        stage_id: {
          [Op.in]: Sequelize.literal(`(SELECT stage_id FROM job_process_sub_stage WHERE sub_stage_id = '${deletedSubStageId}')`),
        },
        sub_stage_id: { [Op.ne]: deletedSubStageId },
      },
      order: [["sort_order", "ASC"]],
      transaction,
    });
  } else {
    targetSubStage = await JobProcessSubStage.findOne({
      where: {
        stage_id: stageId,
        sort_order: { [Op.gt]: deletedSortOrder },
      },
      order: [["sort_order", "ASC"]],
      transaction,
    });
  }

  if (!targetSubStage) {
    throw new Error("No target sub-stage available for task relocation");
  }

  const tasksToMove = specificTasks || (await JobProcessTask.findAll({
    where: { sub_stage_id: deletedSubStageId },
    order: [["sort_order", "ASC"]],
    transaction,
  }));

  const maxTaskSortOrder = (await JobProcessTask.max("sort_order", {
    where: { sub_stage_id: targetSubStage.sub_stage_id },
    transaction,
  })) || 0;

  for (let i = 0; i < tasksToMove.length; i++) {
    const task = tasksToMove[i];
    await task.update({
      sub_stage_id: targetSubStage.sub_stage_id,
      sort_order: maxTaskSortOrder + i + 1,
    }, { transaction });
  }
}

export async function getJobProcess(companyId, builderId) {
  const { JobProcessStage, JobProcessSubStage, JobProcessTask, JobProcessSubtask, JobProcessTaskDependency, JobProcessStageFunctionality } = db;

  const data = await JobProcessStage.findAll({
    where: { company_id: companyId, builder_id: builderId },
    include: [
      { model: JobProcessStageFunctionality, as: "functionality" },
      { model: JobProcessStage, as: "dependentStage", attributes: ["stage_id", "name"] },
      {
        model: JobProcessSubStage,
        as: "subStages",
        include: [
          {
            model: JobProcessTask,
            as: "tasks",
            include: [
              { model: JobProcessSubtask, as: "subtasks" },
              {
                model: JobProcessTaskDependency,
                as: "taskDependencies",
                include: [{ model: JobProcessTask, as: "predecessorTask", attributes: ["job_process_task_id", "name"] }],
              },
            ],
          },
        ],
      },
    ],
    order: [
      ["sort_order", "ASC"],
      [{ model: JobProcessSubStage, as: "subStages" }, "sort_order", "ASC"],
      [{ model: JobProcessSubStage, as: "subStages" }, { model: JobProcessTask, as: "tasks" }, "sort_order", "ASC"],
      [{ model: JobProcessSubStage, as: "subStages" }, { model: JobProcessTask, as: "tasks" }, { model: JobProcessSubtask, as: "subtasks" }, "sort_order", "ASC"],
    ],
  });

  return data.map((s) => {
    const stage = s.get({ plain: true });
    return {
      stageId: stage.stage_id,
      name: stage.name,
      sortOrder: stage.sort_order,
      dependentStage: stage.dependentStage
        ? { id: stage.dependentStage.stage_id, name: stage.dependentStage.name }
        : null,
      functionality: {
        id: stage.functionality.functionality_id,
        name: stage.functionality.name,
        isWorkflow: stage.functionality.is_workflow,
      },
      subStages: (stage.subStages || []).map((ss) => ({
        subStageId: ss.sub_stage_id,
        name: ss.name,
        sortOrder: ss.sort_order,
        tasks: (ss.tasks || []).map((t) => ({
          taskId: t.job_process_task_id,
          name: t.name,
          sortOrder: t.sort_order,
          dependencies: (t.taskDependencies || []).map((d) => ({
            id: d.predecessor_task_id,
            name: d.predecessorTask?.name,
          })),
          subTasks: (t.subtasks || []).map((st) => ({
            subTaskId: st.job_process_subtask_id,
            name: st.name,
            sortOrder: st.sort_order,
          })),
        })),
      })),
    };
  });
}

export async function getStages(companyId, builderId) {
  const { JobProcessStage, JobProcessStageFunctionality } = db;

  const stages = await JobProcessStage.findAll({
    where: { company_id: companyId, builder_id: builderId },
    include: [
      { model: JobProcessStage, as: "dependentStage", attributes: ["stage_id", "name"] },
      { model: JobProcessStageFunctionality, as: "functionality", attributes: ["functionality_id", "name", "is_workflow"] },
    ],
    order: [["sort_order", "ASC"]],
  });

  return stages.map((s) => {
    const plain = s.get({ plain: true });
    return {
      stageId: plain.stage_id,
      name: plain.name,
      sortOrder: plain.sort_order,
      dependentStage: plain.dependentStage
        ? { id: plain.dependentStage.stage_id, name: plain.dependentStage.name }
        : null,
      functionality: {
        id: plain.functionality.functionality_id,
        name: plain.functionality.name,
      },
      isWorkflow: plain.functionality.is_workflow,
    };
  });
}

export async function getSubStages(stageId) {
  const { JobProcessStage, JobProcessStageFunctionality, JobProcessSubStage } = db;

  const stage = await JobProcessStage.findByPk(stageId, {
    include: [{ model: JobProcessStageFunctionality, as: "functionality" }],
  });

  if (!stage || !stage.functionality?.is_workflow) {
    throw new Error("Sub-stages allowed only for workflow stages");
  }

  const subStages = await JobProcessSubStage.findAll({
    where: { stage_id: stageId },
    order: [["sort_order", "ASC"]],
  });

  return subStages.map((ss) => ss.get({ plain: true }));
}

export async function getStageFunctionalities() {
  const { JobProcessStageFunctionality } = db;

  const result = await JobProcessStageFunctionality.findAll({
    order: [["name", "ASC"]],
  });

  return result.map((f) => f.get({ plain: true }));
}

export default {
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
