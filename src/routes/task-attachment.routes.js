const express = require("express");
const router = express.Router();

const {
  createTaskAttachment,
} = require("../controllers/task-attachment.controller");
const {
  createTaskAttachmentSchema,
} = require("../validations/task-attachment.validation");

const { validateRequest } = require("../middleware/validateRequestMiddleware");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const camelToSnakeMiddleware = require("../middleware/caseConverterMiddleware.js");

const { REQUEST_SOURCE } = require("../config/constants");
const { createUpload, handleMulterError } = require("../utils/s3Upload");

router.use(authMiddleware);
router.use(roleMiddleware);

const upload = createUpload("task-attachment");

router.post(
  "/",
  upload.single("file_image"),
  handleMulterError,
  camelToSnakeMiddleware,
  validateRequest(createTaskAttachmentSchema, REQUEST_SOURCE.FORM_DATA),
  createTaskAttachment
);

module.exports = router;
