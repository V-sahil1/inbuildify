const express = require("express");
const router = express.Router();

const {
  createSchedulerEmail,
  getAllSchedulerEmail,
  deleteSchedulerEmail,
  updateSchedulerEmail,
} = require("../controllers/scheduler-email.controller");
const {
  createSchedulerEmailSchema,
  getAllSchedulerEmailSchema,
  deleteSchedulerEmailSchema,
  updateSchedulerEmailParamsSchema,
  updateSchedulerEmailSchema,
} = require("../validations/scheduler-email.validation");
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
  validateRequest(createSchedulerEmailSchema, REQUEST_SOURCE.BODY),
  createSchedulerEmail
);

router.get(
  "/",
  validateRequest(getAllSchedulerEmailSchema, REQUEST_SOURCE.QUERY),
  getAllSchedulerEmail
);

router.delete(
  "/:scheduler_email_id",
  validateRequest(deleteSchedulerEmailSchema, REQUEST_SOURCE.PARAMS),
  deleteSchedulerEmail
);

router.put(
  "/:scheduler_email_id",
  validateRequest(updateSchedulerEmailParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateSchedulerEmailSchema, REQUEST_SOURCE.BODY),
  updateSchedulerEmail
);

module.exports = router;
