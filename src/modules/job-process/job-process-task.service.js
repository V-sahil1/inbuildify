import db from "../../config/database/models/postgre-models/index.js";
import { ensureWorkflowStageBySubStageId } from "./job-process-workflow.guard.js";
import { Sequelize } from "sequelize";

const { Op } = Sequelize;

/**
 * CREATE TASK + DEPENDENCIES
 */
export async function createTaskService(subStageId, payload, builderId, companyId) {
  await ensureWorkflowStageBySubStageId(subStageId);

  const { JobProcessSubStage, JobProcessStage, JobProcessTask, Users, DocumentCommonFolder, JobProcessTaskDependency } = db;

  return await db.sequelize.transaction(async (t) => {
    // Check sub-stage and parent stage for ownership
    const subStage = await JobProcessSubStage.findByPk(subStageId, {
      include: [{
        model: JobProcessStage,
        as: "stage",
        attributes: ["stage_id", "builder_id", "company_id"],
      }],
      transaction: t,
    });

    if (!subStage) {
      throw new Error("Sub-stage not found");
    }

    if (subStage.stage.builder_id !== builderId && subStage.stage.company_id !== companyId) {
      throw new Error("You can only create tasks for your own sub-stages");
    }

    // Validate Assignee
    if (payload.assignee_id) {
      const assignee = await Users.findByPk(payload.assignee_id, { transaction: t });
      if (!assignee) {
        throw new Error("Assignee user not found");
      }
      if (assignee.is_deleted) {
        throw new Error("Cannot assign task to deleted user");
      }
      if (!assignee.is_verified) {
        throw new Error("Cannot assign task to unverified user");
      }
    }

    // Validate Folder
    if (payload.folder_id) {
      const folder = await DocumentCommonFolder.findByPk(payload.folder_id, { transaction: t });
      if (!folder) {
        throw new Error("Folder not found");
      }
    }

    // Duplicate check
    const duplicate = await JobProcessTask.findOne({
      where: { sub_stage_id: subStageId, name: payload.name },
      transaction: t,
    });

    if (duplicate) {
      throw new Error(`Task with name ${payload.name} already exists for this sub-stage`);
    }

    // Sort order rebalancing
    const maxSortOrder = (await JobProcessTask.max("sort_order", {
      where: { sub_stage_id: subStageId },
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
      await JobProcessTask.increment("sort_order", {
        by: 1,
        where: {
          sub_stage_id: subStageId,
          sort_order: { [Op.gte]: payload.sort_order },
        },
        transaction: t,
      });
    }

    const task = await JobProcessTask.create({
      sub_stage_id: subStageId,
      name: payload.name,
      description: payload.description,
      sort_order: finalSortOrder,
      folder_id: payload.folder_id || null,
      no_of_days: payload.no_of_days,
      assignee_id: payload.assignee_id,
      notify: payload.notify,
      milestone: payload.milestone,
      attachment_mandatory: payload.attachment_mandatory,
    }, { transaction: t });

    // Handle Dependencies
    if (payload.predecessor_task_ids && payload.predecessor_task_ids.length > 0) {
      for (const depId of payload.predecessor_task_ids) {
        if (depId === task.job_process_task_id) {
          throw new Error("Task cannot depend on itself");
        }
        await JobProcessTaskDependency.create({
          task_id: task.job_process_task_id,
          predecessor_task_id: depId,
        }, { transaction: t });
      }
    }

    // Fetch refreshed task with assignee info
    const refreshedTask = await JobProcessTask.findByPk(task.job_process_task_id, {
      include: [{ model: Users, as: "assignee", attributes: ["users_id", "name"] }],
      transaction: t,
    });

    const plain = refreshedTask.get({ plain: true });
    return {
      job_process_task_id: plain.job_process_task_id,
      sub_stage_id: plain.sub_stage_id,
      name: plain.name,
      description: plain.description,
      sort_order: plain.sort_order,
      folder_id: plain.folder_id,
      no_of_days: plain.no_of_days,
      assignee: plain.assignee ? { id: plain.assignee.users_id, name: plain.assignee.name } : null,
      notify: plain.notify,
      milestone: plain.milestone,
      attachment_mandatory: plain.attachment_mandatory,
      created_at: plain.created_at,
      updated_at: plain.updated_at,
    };
  });
}

export async function updateTask(taskId, payload, builderId, companyId) {
  const { JobProcessTask, JobProcessSubStage, JobProcessStage, DocumentCommonFolder, JobProcessTaskDependency, Users } = db;

  return await db.sequelize.transaction(async (t) => {
    // Ownership check via deep join
    const task = await JobProcessTask.findByPk(taskId, {
      include: [{
        model: JobProcessSubStage,
        as: "subStage",
        include: [{
          model: JobProcessStage,
          as: "stage",
          where: { builder_id: builderId, company_id: companyId },
        }],
      }],
      transaction: t,
    });

    if (!task) {
      throw new Error("Task not found");
    }

    // Validate Folder
    if (payload.folder_id) {
      const folder = await DocumentCommonFolder.findByPk(payload.folder_id, { transaction: t });
      if (!folder) {
        throw new Error("Folder not found");
      }
    }

    // Duplicate check
    if (payload.name && payload.name !== task.name) {
      const duplicate = await JobProcessTask.findOne({
        where: {
          sub_stage_id: task.sub_stage_id,
          name: payload.name,
          job_process_task_id: { [Op.ne]: taskId },
        },
        transaction: t,
      });

      if (duplicate) {
        throw new Error(`Task with name ${payload.name} already exists for this sub-stage`);
      }
    }

    // Handle sort order shifting
    if (payload.sort_order !== undefined && payload.sort_order !== task.sort_order) {
      const maxSortOrder = await JobProcessTask.max("sort_order", {
        where: { sub_stage_id: task.sub_stage_id },
        transaction: t,
      });

      if (payload.sort_order < 1 || payload.sort_order > maxSortOrder) {
        throw new Error(`Invalid sort_order. Allowed range is 1 to ${maxSortOrder}.`);
      }

      const oldOrder = task.sort_order;
      const newOrder = payload.sort_order;

      if (newOrder > oldOrder) {
        await JobProcessTask.decrement("sort_order", {
          by: 1,
          where: {
            sub_stage_id: task.sub_stage_id,
            sort_order: { [Op.gt]: oldOrder, [Op.lte]: newOrder },
            job_process_task_id: { [Op.ne]: taskId },
          },
          transaction: t,
        });
      } else {
        await JobProcessTask.increment("sort_order", {
          by: 1,
          where: {
            sub_stage_id: task.sub_stage_id,
            sort_order: { [Op.lt]: oldOrder, [Op.gte]: newOrder },
            job_process_task_id: { [Op.ne]: taskId },
          },
          transaction: t,
        });
      }
    }

    await task.update({
      name: payload.name,
      description: payload.description,
      sort_order: payload.sort_order,
      folder_id: payload.folder_id,
      no_of_days: payload.no_of_days,
      assignee_id: payload.assignee_id,
      notify: payload.notify,
      milestone: payload.milestone,
      attachment_mandatory: payload.attachment_mandatory,
      updated_at: new Date(),
    }, { transaction: t });

    // Handle dependencies
    if (payload.predecessor_task_ids !== undefined) {
      await JobProcessTaskDependency.destroy({
        where: { task_id: taskId },
        transaction: t,
      });

      for (const depId of payload.predecessor_task_ids || []) {
        if (depId === taskId) {
          throw new Error("Task cannot depend on itself");
        }
        await JobProcessTaskDependency.create({
          task_id: taskId,
          predecessor_task_id: depId,
        }, { transaction: t });
      }
    }

    // Refresh with dependencies and assignee
    const refreshed = await JobProcessTask.findByPk(taskId, {
      include: [
        { model: Users, as: "assignee", attributes: ["users_id", "name"] },
        {
          model: JobProcessTaskDependency,
          as: "taskDependencies",
          include: [{ model: JobProcessTask, as: "predecessorTask", attributes: ["job_process_task_id", "name"] }],
        },
      ],
      transaction: t,
    });

    const plain = refreshed.get({ plain: true });
    return {
      job_process_task_id: plain.job_process_task_id,
      sub_stage_id: plain.sub_stage_id,
      name: plain.name,
      description: plain.description,
      sort_order: plain.sort_order,
      folder_id: plain.folder_id,
      no_of_days: plain.no_of_days,
      assignee: plain.assignee ? { id: plain.assignee.users_id, name: plain.assignee.name } : null,
      notify: plain.notify,
      milestone: plain.milestone,
      attachment_mandatory: plain.attachment_mandatory,
      predecessor_task_ids: (plain.taskDependencies || []).map((td) => ({
        id: td.predecessor_task_id,
        name: td.predecessorTask?.name,
      })),
      created_at: plain.created_at,
      updated_at: plain.updated_at,
    };
  });
}

export async function deleteTask(taskId, builderId, companyId) {
  const { JobProcessTask, JobProcessSubStage, JobProcessStage, JobProcessTaskDependency } = db;

  return await db.sequelize.transaction(async (t) => {
    // Ownership check via join
    const task = await JobProcessTask.findByPk(taskId, {
      include: [{
        model: JobProcessSubStage,
        as: "subStage",
        include: [{
          model: JobProcessStage,
          as: "stage",
          where: { builder_id: builderId, company_id: companyId },
        }],
      }],
      transaction: t,
    });

    if (!task) {
      throw new Error("Task not found");
    }

    const existingSortOrder = task.sort_order;
    const subStageId = task.sub_stage_id;

    // Shift trailing tasks
    await JobProcessTask.decrement("sort_order", {
      by: 1,
      where: {
        sub_stage_id: subStageId,
        sort_order: { [Op.gt]: existingSortOrder },
      },
      transaction: t,
    });

    // Destroy task
    await task.destroy({ transaction: t });

    // Cleanup dependencies where it was a predecessor
    await JobProcessTaskDependency.destroy({
      where: { predecessor_task_id: taskId },
      transaction: t,
    });
  });
}

export async function getTasks(subStageId, builderId, companyId) {
  const { JobProcessTask, JobProcessSubStage, JobProcessStage, Users, DocumentCommonFolder, JobProcessTaskDependency, JobProcessSubtask } = db;

  const tasks = await JobProcessTask.findAll({
    where: { sub_stage_id: subStageId },
    include: [
      {
        model: JobProcessSubStage,
        as: "subStage",
        required: true,
        include: [{
          model: JobProcessStage,
          as: "stage",
          required: true,
          where: { [Op.or]: [{ builder_id: builderId }, { company_id: companyId }] },
        }],
      },
      { model: Users, as: "assignee", attributes: ["users_id", "name"] },
      { model: DocumentCommonFolder, as: "folder", attributes: ["document_common_folder_id", "name"] },
      {
        model: JobProcessTaskDependency,
        as: "taskDependencies",
        include: [{ model: JobProcessTask, as: "predecessorTask", attributes: ["job_process_task_id", "name"] }],
      },
      { model: JobProcessSubtask, as: "subtasks" },
    ],
    order: [
      ["sort_order", "ASC"],
      [{ model: JobProcessSubtask, as: "subtasks" }, "sort_order", "ASC"],
    ],
  });

  return tasks.map((t) => {
    const task = t.get({ plain: true });
    return {
      jobProcessTaskId: task.job_process_task_id,
      name: task.name,
      description: task.description,
      sortOrder: task.sort_order,
      noOfDays: task.no_of_days,
      assignee: task.assignee ? { id: task.assignee.users_id, name: task.assignee.name } : null,
      folder: task.folder ? { id: task.folder.document_common_folder_id, name: task.folder.name } : null,
      notify: task.notify,
      milestone: task.milestone,
      attachmentMandatory: task.attachment_mandatory,
      predecessorTask: (task.taskDependencies || []).map((td) => ({
        taskId: td.predecessor_task_id,
        name: td.predecessorTask?.name,
      })),
      subTasks: (task.subtasks || []).map((st) => ({
        subTaskId: st.job_process_subtask_id,
        name: st.name,
        sortOrder: st.sort_order,
      })),
    };
  });
}

/**
 * CREATE SUB-TASK
 */
export async function createSubTask(taskId, payload, builderId, companyId) {
  const { JobProcessTask, JobProcessSubStage, JobProcessStage, JobProcessSubtask } = db;

  return await db.sequelize.transaction(async (t) => {
    // Ownership check via deep join
    const task = await JobProcessTask.findByPk(taskId, {
      include: [{
        model: JobProcessSubStage,
        as: "subStage",
        include: [{
          model: JobProcessStage,
          as: "stage",
          where: { builder_id: builderId, company_id: companyId },
        }],
      }],
      transaction: t,
    });

    if (!task) {
      throw new Error("Task not found");
    }

    // Duplicate check
    const duplicate = await JobProcessSubtask.findOne({
      where: { job_process_task_id: taskId, name: payload.name },
      transaction: t,
    });

    if (duplicate) {
      throw new Error(`Sub-task with name ${payload.name} already exists for this task`);
    }

    // Sort order rebalancing
    const maxSortOrder = (await JobProcessSubtask.max("sort_order", {
      where: { job_process_task_id: taskId },
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
      await JobProcessSubtask.increment("sort_order", {
        by: 1,
        where: {
          job_process_task_id: taskId,
          sort_order: { [Op.gte]: payload.sort_order },
        },
        transaction: t,
      });
    }

    const subTask = await JobProcessSubtask.create({
      job_process_task_id: taskId,
      name: payload.name,
      sort_order: finalSortOrder,
    }, { transaction: t });

    // Refresh with parent task name
    const refreshed = await JobProcessSubtask.findByPk(subTask.job_process_subtask_id, {
      include: [{ model: JobProcessTask, as: "jobProcessTask", attributes: ["job_process_task_id", "name"] }],
      transaction: t,
    });

    const plain = refreshed.get({ plain: true });
    return {
      jobProcessSubtaskId: plain.job_process_subtask_id,
      name: plain.name,
      sortOrder: plain.sort_order,
      jobProcessTask: {
        id: plain.jobProcessTask.job_process_task_id,
        name: plain.jobProcessTask.name,
      },
      createdAt: plain.createdAt,
      updatedAt: plain.updatedAt,
    };
  });
}

export async function updateSubTask(subTaskId, payload, builderId, companyId) {
  const { JobProcessSubtask, JobProcessTask, JobProcessSubStage, JobProcessStage } = db;

  return await db.sequelize.transaction(async (t) => {
    // Ownership check via deep join
    const subTask = await JobProcessSubtask.findByPk(subTaskId, {
      include: [{
        model: JobProcessTask,
        as: "jobProcessTask",
        include: [{
          model: JobProcessSubStage,
          as: "subStage",
          include: [{
            model: JobProcessStage,
            as: "stage",
            where: { builder_id: builderId, company_id: companyId },
          }],
        }],
      }],
      transaction: t,
    });

    if (!subTask) {
      throw new Error("Sub-task not found");
    }

    // Duplicate check
    if (payload.name && payload.name !== subTask.name) {
      const duplicate = await JobProcessSubtask.findOne({
        where: {
          job_process_task_id: subTask.job_process_task_id,
          name: payload.name,
          job_process_subtask_id: { [Op.ne]: subTaskId },
        },
        transaction: t,
      });

      if (duplicate) {
        throw new Error(`Sub-task with name ${payload.name} already exists for this task`);
      }
    }

    // Sort order rebalancing
    if (payload.sort_order !== undefined && payload.sort_order !== subTask.sort_order) {
      const maxSortOrder = await JobProcessSubtask.max("sort_order", {
        where: { job_process_task_id: subTask.job_process_task_id },
        transaction: t,
      });

      if (payload.sort_order < 1 || payload.sort_order > maxSortOrder) {
        throw new Error(`Invalid sort_order. Allowed range is 1 to ${maxSortOrder}.`);
      }

      const oldOrder = subTask.sort_order;
      const newOrder = payload.sort_order;

      if (newOrder > oldOrder) {
        await JobProcessSubtask.decrement("sort_order", {
          by: 1,
          where: {
            job_process_task_id: subTask.job_process_task_id,
            sort_order: { [Op.gt]: oldOrder, [Op.lte]: newOrder },
            job_process_subtask_id: { [Op.ne]: subTaskId },
          },
          transaction: t,
        });
      } else {
        await JobProcessSubtask.increment("sort_order", {
          by: 1,
          where: {
            job_process_task_id: subTask.job_process_task_id,
            sort_order: { [Op.lt]: oldOrder, [Op.gte]: newOrder },
            job_process_subtask_id: { [Op.ne]: subTaskId },
          },
          transaction: t,
        });
      }
    }

    await subTask.update({
      name: payload.name,
      sort_order: payload.sort_order,
    }, { transaction: t });

    // Refresh response data
    const refreshed = await JobProcessSubtask.findByPk(subTaskId, {
      include: [{ model: JobProcessTask, as: "jobProcessTask", attributes: ["job_process_task_id", "name"] }],
      transaction: t,
    });

    const plain = refreshed.get({ plain: true });
    return {
      jobProcessSubtaskId: plain.job_process_subtask_id,
      name: plain.name,
      sortOrder: plain.sort_order,
      jobProcessTask: {
        id: plain.jobProcessTask.job_process_task_id,
        name: plain.jobProcessTask.name,
      },
      createdAt: plain.createdAt,
      updatedAt: plain.updatedAt,
    };
  });
}

/**
 * DELETE SUB-TASK
 */
export async function deleteSubTask(subTaskId, builderId, companyId) {
  const { JobProcessSubtask, JobProcessTask, JobProcessSubStage, JobProcessStage } = db;

  return await db.sequelize.transaction(async (t) => {
    // Ownership check via deep join
    const subTask = await JobProcessSubtask.findByPk(subTaskId, {
      include: [{
        model: JobProcessTask,
        as: "jobProcessTask",
        include: [{
          model: JobProcessSubStage,
          as: "subStage",
          include: [{
            model: JobProcessStage,
            as: "stage",
            where: { builder_id: builderId, company_id: companyId },
          }],
        }],
      }],
      transaction: t,
    });

    if (!subTask) {
      throw new Error("Sub-task not found");
    }

    const existingSortOrder = subTask.sort_order;
    const taskId = subTask.job_process_task_id;

    // Shift trailing sub-tasks
    await JobProcessSubtask.decrement("sort_order", {
      by: 1,
      where: {
        job_process_task_id: taskId,
        sort_order: { [Op.gt]: existingSortOrder },
      },
      transaction: t,
    });

    await subTask.destroy({ transaction: t });
  });
}

/**
 * DELETE TASK DEPENDENCY
 */
export async function deleteTaskDependency(taskId, predecessorTaskId, builderId, companyId) {
  const { JobProcessTask, JobProcessSubStage, JobProcessStage, JobProcessTaskDependency } = db;

  return await db.sequelize.transaction(async (t) => {
    // Ownership check via join
    const task = await JobProcessTask.findByPk(taskId, {
      include: [{
        model: JobProcessSubStage,
        as: "subStage",
        include: [{
          model: JobProcessStage,
          as: "stage",
          where: { builder_id: builderId, company_id: companyId },
        }],
      }],
      transaction: t,
    });

    if (!task) {
      throw new Error("Task not found");
    }

    const dependency = await JobProcessTaskDependency.findOne({
      where: { task_id: taskId, predecessor_task_id: predecessorTaskId },
      transaction: t,
    });

    if (!dependency) {
      throw new Error("Task dependency not found");
    }

    await dependency.destroy({ transaction: t });
  });
}

export async function getAllJobTasks(builderId, companyId) {
  const { JobProcessTask, JobProcessSubStage, JobProcessStage, JobProcessTaskDependency, JobProcessSubtask } = db;

  const tasks = await JobProcessTask.findAll({
    include: [
      {
        model: JobProcessSubStage,
        as: "subStage",
        required: true,
        include: [{
          model: JobProcessStage,
          as: "stage",
          required: true,
          where: { builder_id: builderId, company_id: companyId },
        }],
      },
      {
        model: JobProcessTaskDependency,
        as: "taskDependencies",
        include: [{ model: JobProcessTask, as: "predecessorTask", attributes: ["job_process_task_id", "name"] }],
      },
      { model: JobProcessSubtask, as: "subtasks" },
    ],
    order: [
      [{ model: JobProcessSubStage, as: "subStage" }, { model: JobProcessStage, as: "stage" }, "sort_order", "ASC"],
      [{ model: JobProcessSubStage, as: "subStage" }, "sort_order", "ASC"],
      ["sort_order", "ASC"],
      [{ model: JobProcessSubtask, as: "subtasks" }, "sort_order", "ASC"],
    ],
  });

  return tasks.map((t) => {
    const task = t.get({ plain: true });
    return {
      taskId: task.job_process_task_id,
      name: task.name,
      description: task.description,
      sortOrder: task.sort_order,
      noOfDays: task.no_of_days,
      assigneeId: task.assignee_id,
      notify: task.notify,
      milestone: task.milestone,
      attachmentMandatory: task.attachment_mandatory,
      createdAt: task.created_at,
      updatedAt: task.updated_at,
      predecessorTask: (task.taskDependencies || []).map((td) => ({
        id: td.predecessor_task_id,
        name: td.predecessorTask?.name || "Unknown Task",
      })),
      subStage: {
        subStageId: task.subStage.sub_stage_id,
        name: task.subStage.name,
        sortOrder: task.subStage.sort_order,
      },
      stage: {
        stageId: task.subStage.stage.stage_id,
        name: task.subStage.stage.name,
        sortOrder: task.subStage.stage.sort_order,
      },
      subTasks: (task.subtasks || []).map((st) => ({
        jobProcessSubtaskId: st.job_process_subtask_id,
        name: st.name,
        sortOrder: st.sort_order,
      })),
    };
  });
}

/**
 * GET SUB-TASKS BY TASK
 */
export async function getSubTasks(taskId, builderId, companyId) {
  const { JobProcessSubtask, JobProcessTask, JobProcessSubStage, JobProcessStage } = db;

  const subTasks = await JobProcessSubtask.findAll({
    where: { job_process_task_id: taskId },
    include: [{
      model: JobProcessTask,
      as: "jobProcessTask",
      required: true,
      include: [{
        model: JobProcessSubStage,
        as: "subStage",
        required: true,
        include: [{
          model: JobProcessStage,
          as: "stage",
          required: true,
          where: { [Op.or]: [{ builder_id: builderId }, { company_id: companyId }] },
        }],
      }],
    }],
    order: [["sort_order", "ASC"]],
  });

  return subTasks.map((st) => {
    const subTask = st.get({ plain: true });
    return {
      jobProcessSubtaskId: subTask.job_process_subtask_id,
      name: subTask.name,
      sortOrder: subTask.sort_order,
      jobProcessTask: {
        id: subTask.jobProcessTask.job_process_task_id,
        name: subTask.jobProcessTask.name,
      },
      createdAt: subTask.createdAt,
      updatedAt: subTask.updatedAt,
    };
  });
}

/**
 * GET ALL TASKS - TASK DETAILS ONLY
 */
export async function getAllTasksOnly(builderId, companyId) {
  const { JobProcessTask, JobProcessSubStage, JobProcessStage, JobProcessTaskDependency } = db;

  const tasks = await JobProcessTask.findAll({
    include: [
      {
        model: JobProcessSubStage,
        as: "subStage",
        required: true,
        include: [{
          model: JobProcessStage,
          as: "stage",
          required: true,
          where: { builder_id: builderId, company_id: companyId },
        }],
      },
      {
        model: JobProcessTaskDependency,
        as: "taskDependencies",
        include: [{ model: JobProcessTask, as: "predecessorTask", attributes: ["job_process_task_id", "name"] }],
      },
    ],
    order: [["sort_order", "ASC"]],
  });

  return tasks.map((t) => {
    const task = t.get({ plain: true });
    return {
      jobProcessTaskId: task.job_process_task_id,
      name: task.name,
      description: task.description,
      sortOrder: task.sort_order,
      noOfDays: task.no_of_days,
      assigneeId: task.assignee_id,
      notify: task.notify,
      milestone: task.milestone,
      attachmentMandatory: task.attachment_mandatory,
      predecessorTask: (task.taskDependencies || []).map((td) => ({
        id: td.predecessor_task_id,
        name: td.predecessorTask?.name || "Unknown Task",
      })),
      createdAt: task.created_at,
      updated_at: task.updated_at,
    };
  });
}

export default {
  createTaskService,
  updateTask,
  deleteTask,
  getTasks,
  createSubTask,
  updateSubTask,
  deleteSubTask,
  getSubTasks,
  getAllJobTasks,
  getAllTasksOnly,
  deleteTaskDependency,
};
