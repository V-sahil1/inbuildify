const express = require("express");
const router = express.Router();

const agentReferralPartnerController = require("../controllers/agent-referral-partner.controller");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const camelToSnakeMiddleware = require("../middleware/caseConverterMiddleware");

const {
  createAgentReferralPartnerSchema,
  updateAgentReferralPartnerSchema,
  getAgentReferralPartnerSchema,
  paramsIdSchema,
} = require("../validations/agent-referral-partner.validation");
const { validateRequest } = require("../middleware/validateRequestMiddleware");
const { REQUEST_SOURCE } = require("../config/constants");

router.use(authMiddleware);
router.use(roleMiddleware);
router.use(camelToSnakeMiddleware);

router.post(
  "/",
  validateRequest(createAgentReferralPartnerSchema, REQUEST_SOURCE.BODY),
  agentReferralPartnerController.createAgentReferralPartner,
);

router.get(
  "/",
  validateRequest(getAgentReferralPartnerSchema, REQUEST_SOURCE.QUERY),
  agentReferralPartnerController.getAgentReferralPartners,
);

router.get(
  "/:partner_id",
  agentReferralPartnerController.getAgentReferralPartnerById,
);

router.put(
  "/:partner_id",
  validateRequest(paramsIdSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateAgentReferralPartnerSchema, REQUEST_SOURCE.BODY),
  agentReferralPartnerController.updateAgentReferralPartner,
);

router.delete(
  "/:partner_id",
  validateRequest(paramsIdSchema, REQUEST_SOURCE.PARAMS),
  agentReferralPartnerController.deleteAgentReferralPartner,
);

module.exports = router;
