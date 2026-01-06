const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const camelToSnakeMiddleware = require("../middleware/caseConverterMiddleware");
const { validateRequest } = require("../middleware/validateRequestMiddleware");
const { REQUEST_SOURCE } = require("../config/constants");

const controller = require("../controllers/job-process.controller");
const validation = require("../validations/job-process.validation");

router.use(authMiddleware);
router.use(roleMiddleware);

/* ================= STAGE ================= */

router.post(
  "/stages",
  camelToSnakeMiddleware,
  validateRequest(validation.createStageSchema, REQUEST_SOURCE.BODY),
  controller.createStage
);

router.get(
  "/stages",
  controller.getStages
);

router.put(
  "/stages/:stageId",
  camelToSnakeMiddleware,
  validateRequest(validation.stageParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(validation.updateStageSchema, REQUEST_SOURCE.BODY),
  controller.updateStage
);

router.delete(
  "/stages/:stageId",
  validateRequest(validation.stageParamsSchema, REQUEST_SOURCE.PARAMS),
  controller.deleteStage
);

/* ================= SUB-STAGE ================= */

router.post(
  "/stages/:stageId/sub-stages",
  camelToSnakeMiddleware,
  validateRequest(validation.createSubStageSchema, REQUEST_SOURCE.BODY),
  controller.createSubStage
);

router.get(
  "/stages/:stageId/sub-stages",
  validateRequest(validation.stageParamsSchema, REQUEST_SOURCE.PARAMS),
  controller.getSubStages
);

router.put(
  "/sub-stages/:subStageId",
  camelToSnakeMiddleware,
  validateRequest(validation.subStageParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(validation.updateSubStageSchema, REQUEST_SOURCE.BODY),
  controller.updateSubStage
);

router.delete(
  "/sub-stages/:subStageId",
  validateRequest(validation.subStageParamsSchema, REQUEST_SOURCE.PARAMS),
  controller.deleteSubStage
);

/* ================= TASK ================= */

router.post(
  "/sub-stages/:subStageId/tasks",
  camelToSnakeMiddleware,
  validateRequest(validation.createTaskSchema, REQUEST_SOURCE.BODY),
  controller.createTask
);

router.get(
  "/sub-stages/:subStageId/tasks",
  validateRequest(validation.subStageParamsSchema, REQUEST_SOURCE.PARAMS),
  controller.getTasks
);

router.put(
  "/tasks/:taskId",
  camelToSnakeMiddleware,
  validateRequest(validation.taskParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(validation.updateTaskSchema, REQUEST_SOURCE.BODY),
  controller.updateTask
);

router.delete(
  "/tasks/:taskId",
  validateRequest(validation.taskParamsSchema, REQUEST_SOURCE.PARAMS),
  controller.deleteTask
);

/* ================= SUB-TASK ================= */

router.post(
  "/tasks/:taskId/sub-tasks",
  camelToSnakeMiddleware,
  validateRequest(validation.taskParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(validation.createSubTaskSchema, REQUEST_SOURCE.BODY),
  controller.createSubTask
);

router.get(
  "/tasks/:taskId/sub-tasks",
  validateRequest(validation.taskParamsSchema, REQUEST_SOURCE.PARAMS),
  controller.getSubTasks
);

router.put(
  "/sub-tasks/:subTaskId",
  camelToSnakeMiddleware,
  validateRequest(validation.subTaskParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(validation.updateSubTaskSchema, REQUEST_SOURCE.BODY),
  controller.updateSubTask
);

router.delete(
  "/sub-tasks/:subTaskId",
  validateRequest(validation.subTaskParamsSchema, REQUEST_SOURCE.PARAMS),
  controller.deleteSubTask
);

/* ================= JOB PROCESS TREE ================= */

router.get(
  "/",
  controller.getJobProcess
);

module.exports = router;
