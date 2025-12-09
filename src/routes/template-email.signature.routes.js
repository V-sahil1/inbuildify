const express = require("express");
const router = express.Router();

const {
  createTemplateEmailSignature,
  getTemplateEmailSignature,
  updateTemplateEmailSignature,
} = require("../controllers/template-email-signature.controller");
const {
  createTemplateEmailSignatureSchema,
  updateTemplateEmailSignatureParamsSchema,
  updateTemplateEmailSignatureSchema,
} = require("../validations/template-email-signature.validation");

const { validateRequest } = require("../middleware/validateRequestMiddleware");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

const { REQUEST_SOURCE } = require("../config/constants");

router.use(authMiddleware);
router.use(roleMiddleware);

router.post(
  "/",
  validateRequest(createTemplateEmailSignatureSchema, REQUEST_SOURCE.BODY),
  createTemplateEmailSignature
);

router.get("/", getTemplateEmailSignature);

router.put(
  "/:template_email_signature_id",
  validateRequest(
    updateTemplateEmailSignatureParamsSchema,
    REQUEST_SOURCE.PARAMS
  ),
  validateRequest(updateTemplateEmailSignatureSchema, REQUEST_SOURCE.BODY),
  updateTemplateEmailSignature
);
module.exports = router;
