const express = require("express");
const router = express.Router();

const {
  createTemplateEmail,
  updateTemplateEmail,
  deleteTemplateEmail,
  updateTemplateEmailIsActive,
  getTemplateEmails
} = require("../controllers/template-email.controller");
const {
  createTemplateEmailSchema,
  getAllTemplateEmailSchema,
  updateTemplateEmailParamsSchema,
  updateTemplateEmailSchem,
  deleteTemplateEmailSchema,
  updateTemplateEmailIsActiveSchema,
} = require("../validations/template-email.validation");

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
  validateRequest(createTemplateEmailSchema, REQUEST_SOURCE.BODY),
  createTemplateEmail
);

router.get(
  "/",
  getTemplateEmails
);

router.put(
  "/:id",
  validateRequest(updateTemplateEmailParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateTemplateEmailSchem, REQUEST_SOURCE.BODY),
  updateTemplateEmail
);

router.delete(
  "/:template_email_id",
  validateRequest(deleteTemplateEmailSchema, REQUEST_SOURCE.PARAMS),
  deleteTemplateEmail
);

router.put(
  "/is-active/:id",
  validateRequest(updateTemplateEmailParamsSchema, REQUEST_SOURCE.PARAMS),
  updateTemplateEmailIsActive
);
module.exports = router;
