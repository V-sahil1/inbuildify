const express = require("express");
const router = express.Router();
const {
  createConstructionEtsRechargeApproval,
  getAllConstructionEtsRechargeApprovals,
  getConstructionEtsRechargeApprovalById,
  updateConstructionEtsRechargeApproval,
  deleteConstructionEtsRechargeApproval,
} = require("./construction-ets-recharge-approval.controller.js");
const {
  createConstructionEtsRechargeApprovalValidation,
  updateConstructionEtsRechargeApprovalValidation,
  getConstructionEtsRechargeApprovalByIdValidation,
  queryValidation,
} = require("./construction-ets-recharge-approval.validation.js");

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
  validateRequest(createConstructionEtsRechargeApprovalValidation, REQUEST_SOURCE.BODY),
  createConstructionEtsRechargeApproval
);

router.get(
  "/",
  validateRequest(queryValidation, REQUEST_SOURCE.QUERY),
  getAllConstructionEtsRechargeApprovals
);

router.get(
  "/:construction_ets_recharge_approval_id",
  validateRequest(getConstructionEtsRechargeApprovalByIdValidation, REQUEST_SOURCE.PARAMS),
  getConstructionEtsRechargeApprovalById
);

router.put(
  "/:construction_ets_recharge_approval_id",
  validateRequest(getConstructionEtsRechargeApprovalByIdValidation, REQUEST_SOURCE.PARAMS),
  validateRequest(updateConstructionEtsRechargeApprovalValidation, REQUEST_SOURCE.BODY),
  updateConstructionEtsRechargeApproval
);

router.delete(
  "/:construction_ets_recharge_approval_id",
  validateRequest(getConstructionEtsRechargeApprovalByIdValidation, REQUEST_SOURCE.PARAMS),
  deleteConstructionEtsRechargeApproval
);

module.exports = router;