import express from "express";

const router = express.Router();

import {
  createTemplateEmail,
  updateTemplateEmail,
  deleteTemplateEmail,
  updateTemplateEmailIsActive,
  getTemplateEmails,
} from "./template-email.controller.js";
import {
  createTemplateEmailSchema,
  getAllTemplateEmailSchema,
  updateTemplateEmailParamsSchema,
  updateTemplateEmailSchem,
  deleteTemplateEmailSchema,
  updateTemplateEmailIsActiveSchema,
} from "./template-email.validation.js";
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
  validateRequest(createTemplateEmailSchema, REQUEST_SOURCE.BODY),
  createTemplateEmail,
);

router.get(
  "/",
  getTemplateEmails,
);

router.put(
  "/:id",
  validateRequest(updateTemplateEmailParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateTemplateEmailSchem, REQUEST_SOURCE.BODY),
  updateTemplateEmail,
);

router.delete(
  "/:template_email_id",
  validateRequest(deleteTemplateEmailSchema, REQUEST_SOURCE.PARAMS),
  deleteTemplateEmail,
);

router.put(
  "/is-active/:id",
  validateRequest(updateTemplateEmailParamsSchema, REQUEST_SOURCE.PARAMS),
  updateTemplateEmailIsActive,
);
export default router;
