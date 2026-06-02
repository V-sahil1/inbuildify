import express from "express";

const router = express.Router();

import {
  updatePasswordPolicy,
  getPasswordPolicy,
} from "./password-policy.controller.js";
import {
  updatePasswordPolicySchema,
} from "./password-policy.validation.js";
import { validateRequest } from "../../middleware/validateRequestMiddleware.js";
import authMiddleware from "../../middleware/authMiddleware.js";
import roleMiddleware from "../../middleware/roleMiddleware.js";
import camelToSnakeMiddleware from "../../middleware/caseConverterMiddleware.js";
import { REQUEST_SOURCE } from "../../config/constants.js";

router.use(authMiddleware);
router.use(roleMiddleware);
router.use(camelToSnakeMiddleware);

router.get("/", getPasswordPolicy);

router.put(
  "/",
  validateRequest(updatePasswordPolicySchema, REQUEST_SOURCE.BODY),
  updatePasswordPolicy,
);

export default router;
