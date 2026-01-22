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
const { createUpload, handleMulterError } = require("../utils/s3Upload");

router.use(authMiddleware);
router.use(roleMiddleware);
const upload = createUpload("task");

router.post(
  "/",
  upload.fields([{ name: "attachFiles", maxCount: 1 }]),
  handleMulterError,
  camelToSnakeMiddleware,
  validateRequest(createTaskSchema, REQUEST_SOURCE.FORM_DATA),
  createTask,
);

router.get(
  "/",
  validateRequest(getAllTaskSchema, REQUEST_SOURCE.QUERY),
  getAllTasks,
);

router.delete(
  "/:task_id",
  validateRequest(deleteTaskSchema, REQUEST_SOURCE.PARAMS),
  deleteTask,
);

router.put(
  "/:task_id",
  upload.fields([{ name: "attachFiles", maxCount: 1 }]),
  handleMulterError,
  camelToSnakeMiddleware,
  validateRequest(updateTaskParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateTaskSchema, REQUEST_SOURCE.FORM_DATA),
  updateTask,
);

module.exports = router;
