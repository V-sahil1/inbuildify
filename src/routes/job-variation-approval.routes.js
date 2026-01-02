const express = require("express");
const router = express.Router();

const {
  createJobVariationApproval,
  getJobVariationApprovals,
  deleteJobVariationApproval,
  updateJobVariationApproval,
} = require("../controllers/job-variation-approval.controller.js");
const {
  createJobVariationApprovalSchema,
  getJobVariationApprovalsSchema,
  deleteJobVariationApprovalSchema,
  updateJobVariationApprovalSchema,
  updateJobVariationApprovalParamsSchema,
} = require("../validations/job-variation-approval.validation.js");

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
  validateRequest(createJobVariationApprovalSchema, REQUEST_SOURCE.BODY),
  createJobVariationApproval
);

router.get(
  "/",
  validateRequest(getJobVariationApprovalsSchema, REQUEST_SOURCE.QUERY),
  getJobVariationApprovals
);

router.put(
  "/:id",
  validateRequest(
    updateJobVariationApprovalParamsSchema,
    REQUEST_SOURCE.PARAMS
  ),
  validateRequest(updateJobVariationApprovalSchema, REQUEST_SOURCE.BODY),
  updateJobVariationApproval
);

router.delete(
  "/:id",
  validateRequest(deleteJobVariationApprovalSchema, REQUEST_SOURCE.PARAMS),
  deleteJobVariationApproval
);

module.exports = router;
