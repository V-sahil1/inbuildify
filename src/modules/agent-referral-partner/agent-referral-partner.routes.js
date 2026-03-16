import express from "express";

const router = express.Router();

import agentReferralPartnerController from "./agent-referral-partner.controller";
import authMiddleware from "../../middleware/authMiddleware";
import roleMiddleware from "../../middleware/roleMiddleware";
import camelToSnakeMiddleware from "../../middleware/caseConverterMiddleware";
import {
  createAgentReferralPartnerSchema,
  updateAgentReferralPartnerSchema,
  getAgentReferralPartnerSchema,
  paramsIdSchema,
} from "./agent-referral-partner.validation";
import { validateRequest } from "../../middleware/validateRequestMiddleware";
import { REQUEST_SOURCE } from "../../config/constants";

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

export default router;
