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

const { REQUEST_SOURCE } = require("../config/constants");
const { createUpload, handleMulterError } = require("../utils/s3Upload");
const { isPlainObject } = require("lodash");

router.use(authMiddleware);
router.use(roleMiddleware);

const upload = createUpload("task-attachment");

router.post(
  "/",
  upload.single("file_image"),
  handleMulterError,
  validateRequest(createTaskAttachmentSchema, REQUEST_SOURCE.FORM_DATA),
  createTaskAttachment
);

module.exports = router;
