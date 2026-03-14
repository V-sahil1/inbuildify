const express = require("express");
const router = express.Router();

const {
  createJobVariationApproval,
  getJobVariationApprovals,
  deleteJobVariationApproval,
  updateJobVariationApproval,
} = require("./job-variation-approval.controller.js");
const {
  createJobVariationApprovalSchema,
  getJobVariationApprovalsSchema,
  deleteJobVariationApprovalSchema,
  updateJobVariationApprovalSchema,
  updateJobVariationApprovalParamsSchema,
} = require("./job-variation-approval.validation.js");

const { validateRequest } = require("../../middleware/validateRequestMiddleware.js");
const authMiddleware = require("../../middleware/authMiddleware.js");
const roleMiddleware = require("../../middleware/roleMiddleware.js");
const camelToSnakeMiddleware = require("../../middleware/caseConverterMiddleware.js");

const { REQUEST_SOURCE } = require("../../config/constants.js");

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
