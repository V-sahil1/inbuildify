const express = require("express");
const router = express.Router();

const {
  createLeadLostReasonSchema,
  getAllLeadLostReasonsSchema,
  deleteLeadLostReasonSchema,
  updateLeadLostReasonSchema,
  updateLeadLostReasonParamsSchema,
  updateLeadLostReasonIsActiveSchema,
} = require("../validations/lead-lost-reason.validation");
const {
  createLeadLostReason,
  getAllLeadLostReasons,
  deleteLeadLostReason,
  updateLeadLostReason,
  updateLeadLostReasonIsActive,
} = require("../controllers/lead-lost-reason.controller");

const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const camelToSnakeMiddleware = require("../middleware/caseConverterMiddleware.js");

const { validateRequest } = require("../middleware/validateRequestMiddleware");
const { REQUEST_SOURCE } = require("../config/constants");

router.use(authMiddleware);
router.use(roleMiddleware);
router.use(camelToSnakeMiddleware);

router.post(
  "/",
  validateRequest(createLeadLostReasonSchema, REQUEST_SOURCE.BODY),
  createLeadLostReason
);

router.get(
  "/",
  validateRequest(getAllLeadLostReasonsSchema, REQUEST_SOURCE.QUERY),
  getAllLeadLostReasons
);

router.delete(
  "/:id",
  validateRequest(deleteLeadLostReasonSchema, REQUEST_SOURCE.PARAMS),
  deleteLeadLostReason
);

router.put(
  "/:id",
  validateRequest(updateLeadLostReasonParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateLeadLostReasonSchema, REQUEST_SOURCE.BODY),
  updateLeadLostReason
);

router.put(
  "/is-active/:id",
  validateRequest(updateLeadLostReasonParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateLeadLostReasonIsActiveSchema, REQUEST_SOURCE.BODY),
  updateLeadLostReasonIsActive
);

module.exports = router;
