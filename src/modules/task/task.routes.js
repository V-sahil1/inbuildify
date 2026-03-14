const express = require("express");
const router = express.Router();

const {
  createTask,
  getAllTasks,
  deleteTask,
  updateTask,
} = require("./task.controller.js");
const {
  createTaskSchema,
  getAllTaskSchema,
  deleteTaskSchema,
  updateTaskParamsSchema,
  updateTaskSchema,
} = require("./task.validation.js");

const { validateRequest } = require("../../middleware/validateRequestMiddleware.js");
const authMiddleware = require("../../middleware/authMiddleware.js");
const roleMiddleware = require("../../middleware/roleMiddleware.js");
const camelToSnakeMiddleware = require("../../middleware/caseConverterMiddleware.js");
const { REQUEST_SOURCE } = require("../../config/constants.js");
const { createUpload, handleMulterError } = require("../../utils/s3Upload.js");

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
