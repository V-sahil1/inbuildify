const { successResponse, errorResponse } = require("../../helper/response");

const { keysToCamelCase } = require("../../utils/common");

// Services

const stageService = require("../../services/job-process-stage.service");

const taskService = require("../../services/job-process-task.service");

/* =========================================================

   STAGE

========================================================= */

exports.createStage = async (req, res) => {
  try {
    const { company_id: companyId, builder_id: builderId } = req.user;

    const stage = await stageService.createStage(
      companyId,

      builderId,

      req.body,
    );

    return successResponse(res, keysToCamelCase(stage), "Stage created");
  } catch (err) {
    return errorResponse(res, 400, err.message);
  }
};

exports.updateStage = async (req, res) => {
  try {
    const { company_id: companyId, builder_id: builderId } = req.user;

    const stage = await stageService.updateStage(
      req.params.stage_id,

      req.body,

      builderId,

      companyId,
    );

    return successResponse(res, keysToCamelCase(stage), "Stage updated");
  } catch (err) {
    return errorResponse(res, 400, err.message);
  }
};

exports.deleteStage = async (req, res) => {
  try {
    const { builder_id: builderId } = req.user;

    await stageService.deleteStage(req.params.stage_id, builderId);

    return successResponse(res, null, "Stage deleted");
  } catch (err) {
    return errorResponse(res, 400, err.message);
  }
};

exports.getStages = async (req, res) => {
  try {
    const { company_id: companyId, builder_id: builderId } = req.user;

    const stages = await stageService.getStages(companyId, builderId);

    return successResponse(res, keysToCamelCase(stages));
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

/* =========================================================

   SUB-STAGE

========================================================= */

exports.createSubStage = async (req, res) => {
  try {
    const subStage = await stageService.createSubStage(
      req.params.stage_id,

      req.body,
    );

    return successResponse(res, keysToCamelCase(subStage), "Sub-stage created");
  } catch (err) {
    return errorResponse(res, 400, err.message);
  }
};

exports.updateSubStage = async (req, res) => {
  try {
    const { builder_id: builderId, company_id: companyId } = req.user;

    const subStage = await stageService.updateSubStage(
      req.params.sub_stage_id,

      req.body,

      builderId,

      companyId,
    );

    return successResponse(res, keysToCamelCase(subStage), "Sub-stage updated");
  } catch (err) {
    return errorResponse(res, 400, err.message);
  }
};

exports.deleteSubStage = async (req, res) => {
  try {
    const { builder_id: builderId, company_id: companyId } = req.user;
    const { task_id: taskId } = req.body || {};

    await stageService.deleteSubStage(
      req.params.sub_stage_id,
      builderId,
      companyId,
      taskId,
    );

    return successResponse(res, null, "Sub-stage deleted");
  } catch (err) {
    return errorResponse(res, 400, err.message);
  }
};

exports.getSubStages = async (req, res) => {
  try {
    const subStages = await stageService.getSubStages(req.params.stage_id);

    return successResponse(res, keysToCamelCase(subStages));
  } catch (err) {
    return errorResponse(res, 400, err.message);
  }
};

/* =========================================================

   TASK

========================================================= */

exports.createTask = async (req, res) => {
  try {
    const { builder_id: builderId, company_id: companyId } = req.user;

    const task = await taskService.createTaskService(
      req.params.sub_stage_id,

      req.body,

      builderId,

      companyId,
    );

    return successResponse(res, keysToCamelCase(task), "Task created");
  } catch (err) {
    return errorResponse(res, 400, err.message);
  }
};

exports.updateTask = async (req, res) => {
  try {
    const { builder_id: builderId, company_id: companyId } = req.user;

    const task = await taskService.updateTask(
      req.params.task_id,

      req.body,

      builderId,

      companyId,
    );

    return successResponse(res, keysToCamelCase(task), "Task updated");
  } catch (err) {
    return errorResponse(res, 400, err.message);
  }
};

exports.deleteTask = async (req, res) => {
  try {
    const { builder_id: builderId, company_id: companyId } = req.user;

    await taskService.deleteTask(req.params.task_id, builderId, companyId);

    return successResponse(res, null, "Task deleted");
  } catch (err) {
    return errorResponse(res, 400, err.message);
  }
};

exports.getTasks = async (req, res) => {
  try {
    const { builder_id: builderId, company_id: companyId } = req.user;

    const tasks = await taskService.getTasks(
      req.params.sub_stage_id,

      builderId,

      companyId,
    );

    return successResponse(res, tasks);
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

/* =========================================================

   SUB-TASK

========================================================= */

exports.createSubTask = async (req, res) => {
  try {
    const { builder_id: builderId, company_id: companyId } = req.user;

    const subTask = await taskService.createSubTask(
      req.params.task_id,

      req.body,

      builderId,

      companyId,
    );

    return successResponse(res, keysToCamelCase(subTask), "Sub-task created");
  } catch (err) {
    return errorResponse(res, 400, err.message);
  }
};

exports.updateSubTask = async (req, res) => {
  try {
    const { builder_id: builderId, company_id: companyId } = req.user;

    const subTask = await taskService.updateSubTask(
      req.params.sub_task_id,

      req.body,

      builderId,

      companyId,
    );

    return successResponse(res, keysToCamelCase(subTask), "Sub-task updated");
  } catch (err) {
    return errorResponse(res, 400, err.message);
  }
};

exports.deleteSubTask = async (req, res) => {
  try {
    const { builder_id: builderId, company_id: companyId } = req.user;

    await taskService.deleteSubTask(
      req.params.sub_task_id,

      builderId,

      companyId,
    );

    return successResponse(res, null, "Sub-task deleted");
  } catch (err) {
    return errorResponse(res, 400, err.message);
  }
};

exports.getSubTasks = async (req, res) => {
  try {
    const { builder_id: builderId, company_id: companyId } = req.user;

    const subTasks = await taskService.getSubTasks(
      req.params.task_id,

      builderId,

      companyId,
    );

    return successResponse(res, keysToCamelCase(subTasks));
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

/* =========================================================

   JOB PROCESS TREE

========================================================= */

exports.getJobProcess = async (req, res) => {
  try {
    const { company_id: companyId, builder_id: builderId } = req.user;

    const data = await stageService.getJobProcess(companyId, builderId);

    return successResponse(res, data);
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

exports.getAllJobTasks = async (req, res) => {
  try {
    const { builder_id: builderId, company_id: companyId } = req.user;

    const tasks = await taskService.getAllJobTasks(builderId, companyId);

    return successResponse(res, tasks, "All job tasks fetched successfully.");
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

exports.getAllTasksOnly = async (req, res) => {
  try {
    const { builder_id: builderId, company_id: companyId } = req.user;

    const tasks = await taskService.getAllTasksOnly(builderId, companyId);

    return successResponse(
      res,
      tasks,
      "All tasks (details only) fetched successfully.",
    );
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

/* =========================================================
   TASK DEPENDENCY
========================================================= */

exports.deleteTaskDependency = async (req, res) => {
  try {
    const { builder_id: builderId, company_id: companyId } = req.user;

    await taskService.deleteTaskDependency(
      req.body.task_id,
      req.body.predecessor_task_id,
      builderId,
      companyId,
    );

    return successResponse(res, null, "Task dependency deleted successfully.");
  } catch (err) {
    return errorResponse(res, 400, err.message);
  }
};
