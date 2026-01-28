const express = require("express");
const router = express.Router();

const agentReferralPartnerController = require("../controllers/agent-referral-partner.controller");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const camelToSnakeMiddleware = require("../middleware/caseConverterMiddleware");

const {
  createAgentReferralPartnerSchema,
  updateAgentReferralPartnerSchema,
} = require("../validation/agent-referral-partner.validation");
const { validateRequest } = require("../middleware/validateRequestMiddleware");
const { REQUEST_SOURCE } = require("../config/constants");

router.post(
  "/",
  camelToSnakeMiddleware,
  authMiddleware,
  roleMiddleware,
  validateRequest(createAgentReferralPartnerSchema, REQUEST_SOURCE.BODY),
  agentReferralPartnerController.createAgentReferralPartner,
);

router.get(
  "/",
  authMiddleware,
  roleMiddleware,
  agentReferralPartnerController.getAgentReferralPartners,
);

router.get(
  "/:partner_id",
  authMiddleware,
  roleMiddleware,
  agentReferralPartnerController.getAgentReferralPartnerById,
);

router.put(
  "/:partner_id",
  camelToSnakeMiddleware,
  authMiddleware,
  roleMiddleware,
  validateRequest(updateAgentReferralPartnerSchema, REQUEST_SOURCE.BODY),
  agentReferralPartnerController.updateAgentReferralPartner,
);

router.delete(
  "/:partner_id",
  authMiddleware,
  roleMiddleware,
  agentReferralPartnerController.deleteAgentReferralPartner,
);

module.exports = router;
