import express from "express";

const router = express.Router();

import {
  createTemplateEmailSignature,
  getTemplateEmailSignature,
  updateTemplateEmailSignature,
} from "./template-email-signature.controller.js";
import { createTemplateEmailSignatureSchema, updateTemplateEmailSignatureSchema } from "./template-email-signature.validation.js";
import { validateRequest } from "../../middleware/validateRequestMiddleware.js";
import authMiddleware from "../../middleware/authMiddleware.js";
import roleMiddleware from "../../middleware/roleMiddleware.js";
import camelToSnakeMiddleware from "../../middleware/caseConverterMiddleware.js";
import { REQUEST_SOURCE } from "../../config/constants.js";

router.use(authMiddleware);
router.use(roleMiddleware);
router.use(camelToSnakeMiddleware);

router.post(
  "/",
  validateRequest(createTemplateEmailSignatureSchema, REQUEST_SOURCE.BODY),
  createTemplateEmailSignature,
);

router.get("/", getTemplateEmailSignature);

router.put(
  "/",
  validateRequest(updateTemplateEmailSignatureSchema, REQUEST_SOURCE.BODY),
  updateTemplateEmailSignature,
);
export default router;
