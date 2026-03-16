import express from "express";

const router = express.Router();

import authMiddleware from "../../middleware/authMiddleware";
import roleMiddleware from "../../middleware/roleMiddleware";
import camelToSnakeMiddleware from "../../middleware/caseConverterMiddleware";
import { validateRequest } from "../../middleware/validateRequestMiddleware";
import { REQUEST_SOURCE } from "../../config/constants";
import controller from "./job-process.controller";
import validation from "../job-process/job-process.validation";

router.use(authMiddleware);
router.use(roleMiddleware);

/* ================= STAGE ================= */

router.post(
  "/stages",
  camelToSnakeMiddleware,
  validateRequest(validation.createStageSchema, REQUEST_SOURCE.BODY),
  controller.createStage,
);

router.get("/stages", controller.getStages);

router.put(
  "/stages/:stage_id",
  camelToSnakeMiddleware,
  validateRequest(validation.stageParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(validation.updateStageSchema, REQUEST_SOURCE.BODY),
  controller.updateStage,
);

router.delete(
  "/stages/:stage_id",
  validateRequest(validation.stageParamsSchema, REQUEST_SOURCE.PARAMS),
  controller.deleteStage,
);

/* ================= SUB-STAGE ================= */

router.post(
  "/stages/:stage_id/sub-stages",
  camelToSnakeMiddleware,
  validateRequest(validation.stageParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(validation.createSubStageSchema, REQUEST_SOURCE.BODY),
  controller.createSubStage,
);

router.get(
  "/stages/:stage_id/sub-stages",
  validateRequest(validation.stageParamsSchema, REQUEST_SOURCE.PARAMS),
  controller.getSubStages,
);

router.put(
  "/sub-stages/:sub_stage_id",
  camelToSnakeMiddleware,
  validateRequest(validation.subStageParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(validation.updateSubStageSchema, REQUEST_SOURCE.BODY),
  controller.updateSubStage,
);

router.delete(
  "/sub-stages/:sub_stage_id",
  camelToSnakeMiddleware,
  validateRequest(validation.subStageParamsSchema, REQUEST_SOURCE.PARAMS),
  // validateRequest(validation.deleteSubStageSchema, REQUEST_SOURCE.BODY),
  controller.deleteSubStage,
);

/* ================= TASK ================= */

router.post(
  "/sub-stages/:sub_stage_id/tasks",
  camelToSnakeMiddleware,
  validateRequest(validation.createTaskSchema, REQUEST_SOURCE.BODY),
  controller.createTask,
);

router.get(
  "/sub-stages/:sub_stage_id/tasks",
  validateRequest(validation.subStageParamsSchema, REQUEST_SOURCE.PARAMS),
  controller.getTasks,
);

router.put(
  "/tasks/:task_id",
  camelToSnakeMiddleware,
  validateRequest(validation.taskParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(validation.updateTaskSchema, REQUEST_SOURCE.BODY),
  controller.updateTask,
);

router.delete(
  "/tasks/:task_id",
  validateRequest(validation.taskParamsSchema, REQUEST_SOURCE.PARAMS),
  controller.deleteTask,
);

/* ================= TASK DEPENDENCY ================= */

router.delete(
  "/task-dependencies",
  camelToSnakeMiddleware,
  validateRequest(validation.deleteTaskDependencySchema, REQUEST_SOURCE.BODY),
  controller.deleteTaskDependency,
);

/* ================= SUB-TASK ================= */

router.post(
  "/tasks/:task_id/sub-tasks",
  camelToSnakeMiddleware,
  validateRequest(validation.taskParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(validation.createSubTaskSchema, REQUEST_SOURCE.BODY),
  controller.createSubTask,
);

router.get(
  "/tasks/:task_id/sub-tasks",
  camelToSnakeMiddleware,
  validateRequest(validation.taskParamsSchema, REQUEST_SOURCE.PARAMS),
  controller.getSubTasks,
);

router.put(
  "/sub-tasks/:sub_task_id",
  camelToSnakeMiddleware,
  validateRequest(validation.subTaskParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(validation.updateSubTaskSchema, REQUEST_SOURCE.BODY),
  controller.updateSubTask,
);

router.delete(
  "/sub-tasks/:sub_task_id",
  camelToSnakeMiddleware,
  validateRequest(validation.subTaskParamsSchema, REQUEST_SOURCE.PARAMS),
  controller.deleteSubTask,
);

router.get("/", controller.getJobProcess);

router.get("/tasks", camelToSnakeMiddleware, controller.getAllJobTasks);

router.get("/tasks-only", camelToSnakeMiddleware, controller.getAllTasksOnly);

export default router;
