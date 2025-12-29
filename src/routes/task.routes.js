const express = require("express");
const router = express.Router();

const {
  createTask,
  getAllTasks,
  deleteTask,
  updateTask,
} = require("../controllers/task.controller");
const {
  createTaskSchema,
  getAllTaskSchema,
  deleteTaskSchema,
  updateTaskParamsSchema,
  updateTaskSchema,
} = require("../validations/task.validation");

const { validateRequest } = require("../middleware/validateRequestMiddleware");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const camelToSnakeMiddleware = require("../middleware/caseConverterMiddleware.js");

const { REQUEST_SOURCE } = require("../config/constants");

router.use(authMiddleware);
router.use(roleMiddleware);
router.use(camelToSnakeMiddleware);

router.post(
  "/",
  validateRequest(createTaskSchema, REQUEST_SOURCE.BODY),
  createTask
);

router.get(
  "/",
  validateRequest(getAllTaskSchema, REQUEST_SOURCE.QUERY),
  getAllTasks
);

router.delete(
  "/:task_id",
  validateRequest(deleteTaskSchema, REQUEST_SOURCE.PARAMS),
  deleteTask
);

router.put(
  "/:task_id",
  validateRequest(updateTaskParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateTaskSchema, REQUEST_SOURCE.BODY),
  updateTask
);

module.exports = router;
