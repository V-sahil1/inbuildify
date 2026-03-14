const express = require("express");
const router = express.Router();

const {
  createTemplateEmailSignature,
  getTemplateEmailSignature,
  updateTemplateEmailSignature,
} = require("./template-email-signature.controller.js");
const {
  createTemplateEmailSignatureSchema,
  updateTemplateEmailSignatureSchema,
} = require("./template-email-signature.validation.js");

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
  validateRequest(createTemplateEmailSignatureSchema, REQUEST_SOURCE.BODY),
  createTemplateEmailSignature,
);

router.get("/", getTemplateEmailSignature);

router.put(
  "/",
  validateRequest(updateTemplateEmailSignatureSchema, REQUEST_SOURCE.BODY),
  updateTemplateEmailSignature,
);
module.exports = router;
