const express = require("express");
const router = express.Router();

const {
  createTemplateEmail,
  getAllTemplateEmails,
  updateTemplateEmail,
  deleteTemplateEmail,
  updateTemplateEmailIsActive,
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

const { REQUEST_SOURCE } = require("../config/constants");

router.use(authMiddleware);
router.use(roleMiddleware);

router.post(
  "/",
  validateRequest(createTemplateEmailSchema, REQUEST_SOURCE.BODY),
  createTemplateEmail
);

router.get(
  "/",
  validateRequest(getAllTemplateEmailSchema, REQUEST_SOURCE.QUERY),
  getAllTemplateEmails
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
  validateRequest(updateTemplateEmailIsActiveSchema, REQUEST_SOURCE.BODY),
  updateTemplateEmailIsActive
);
module.exports = router;
