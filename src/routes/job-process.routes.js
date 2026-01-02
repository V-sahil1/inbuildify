const express = require("express");
const router = express.Router();

const {
  createJobProcess,
  getJobProcesses,
  deleteJobProcess,
  updateJobProcess,
  toggleJobProcessIsActive,
} = require("../controllers/job-process.controller.js");
const {
  createJobProcessSchema,
  getJobProcessesSchema,
  deleteJobProcessSchema,
  updateJobProcessSchema,
  updateJobProcessParamsSchema,
  toggleJobProcessIsActiveParamsSchema,
} = require("../validations/job-process.validation.js");

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
  validateRequest(createJobProcessSchema, REQUEST_SOURCE.BODY),
  createJobProcess
);

router.get(
  "/",
  validateRequest(getJobProcessesSchema, REQUEST_SOURCE.QUERY),
  getJobProcesses
);

router.put(
  "/:id",
  validateRequest(updateJobProcessParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateJobProcessSchema, REQUEST_SOURCE.BODY),
  updateJobProcess
);

router.patch(
  "/:id/toggle-is-active",
  validateRequest(toggleJobProcessIsActiveParamsSchema, REQUEST_SOURCE.PARAMS),
  toggleJobProcessIsActive
);

router.delete(
  "/:id",
  validateRequest(deleteJobProcessSchema, REQUEST_SOURCE.PARAMS),
  deleteJobProcess
);

module.exports = router;
