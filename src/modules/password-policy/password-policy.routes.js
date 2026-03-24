import express from "express";

const router = express.Router();

import {
  createPasswordPolicy,
  updatePasswordPolicy,
  updatePasswordPolicyIsActive,
  getPasswordPolicy,
} from "./password-policy.controller.js";
import {
  cretePasswordPolicySchema,
  updatePasswordPolicyIdParamsSchema,
  updatePasswordPolicySchema,
  updatePasswordPolicyIsActiveSchema,
} from "./password-policy.validation.js";
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
  validateRequest(cretePasswordPolicySchema, REQUEST_SOURCE.BODY),
  createPasswordPolicy,
);

router.put(
  "/",
  validateRequest(updatePasswordPolicySchema, REQUEST_SOURCE.BODY),
  updatePasswordPolicy,
);

router.put(
  "/is-active",
  validateRequest(updatePasswordPolicyIsActiveSchema, REQUEST_SOURCE.BODY),
  updatePasswordPolicyIsActive,
);

router.get("/", getPasswordPolicy);

export default router;
