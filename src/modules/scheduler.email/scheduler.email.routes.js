const express = require("express");
const router = express.Router();

const {
  createSchedulerEmail,
  getAllSchedulerEmail,
  deleteSchedulerEmail,
  updateSchedulerEmail,
  getSchedulerEmails,
  toggleSchedulerEmailStatus,
} = require("./scheduler-email.controller.js");
const {
  createSchedulerEmailSchema,
  getAllSchedulerEmailSchema,
  getSchedulerEmailSchema,
  deleteSchedulerEmailSchema,
  updateSchedulerEmailParamsSchema,
  updateSchedulerEmailSchema,
} = require("./scheduler-email.validation.js");
const { validateRequest } = require("../../middleware/validateRequestMiddleware.js");
const authMiddleware = require("../../middleware/authMiddleware.js");
const roleMiddleware = require("../../middleware/roleMiddleware.js");
const camelToSnakeMiddleware = require("../../middleware/caseConverterMiddleware.js");

const { createUpload, handleMulterError } = require("../../utils/s3Upload.js");

const { REQUEST_SOURCE } = require("../../config/constants.js");

router.use(authMiddleware);
router.use(roleMiddleware);

const upload = createUpload("scheduler-email");

router.post(
  "/",
  upload.single("attachFiles"),
  handleMulterError,
  camelToSnakeMiddleware,
  validateRequest(createSchedulerEmailSchema, REQUEST_SOURCE.FORM_DATA),
  createSchedulerEmail,
);

// router.get(
//   "/",
//   validateRequest(getAllSchedulerEmailSchema, REQUEST_SOURCE.QUERY),
//   getAllSchedulerEmail
// );

router.get(
  "/",
  validateRequest(getSchedulerEmailSchema, REQUEST_SOURCE.QUERY),
  getSchedulerEmails,
);

router.delete(
  "/:scheduler_email_id",
  validateRequest(deleteSchedulerEmailSchema, REQUEST_SOURCE.PARAMS),
  deleteSchedulerEmail,
);

router.put(
  "/:scheduler_email_id",
  upload.single("attachFiles"),
  handleMulterError,
  camelToSnakeMiddleware,
  validateRequest(updateSchedulerEmailParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateSchedulerEmailSchema, REQUEST_SOURCE.BODY),
  updateSchedulerEmail,
);

router.put(
  "/is-active/:scheduler_email_id",
  validateRequest(deleteSchedulerEmailSchema, REQUEST_SOURCE.PARAMS),
  toggleSchedulerEmailStatus,
);

module.exports = router;
