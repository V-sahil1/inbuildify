const express = require("express");
const router = express.Router();

const {
  createPasswordPolicy,
  updatePasswordPolicy,
  updatePasswordPolicyIsActive,
  getPasswordPolicy,
} = require("./password-policy.controller.js");
const {
  cretePasswordPolicySchema,
  updatePasswordPolicyIdParamsSchema,
  updatePasswordPolicySchema,
  updatePasswordPolicyIsActiveSchema,
} = require("./password-policy.validation.js");

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
  validateRequest(cretePasswordPolicySchema, REQUEST_SOURCE.BODY),
  createPasswordPolicy
);

router.put(
  "/",
  validateRequest(updatePasswordPolicySchema, REQUEST_SOURCE.BODY),
  updatePasswordPolicy
);

router.put(
  "/is-active",
  validateRequest(updatePasswordPolicyIsActiveSchema, REQUEST_SOURCE.BODY),
  updatePasswordPolicyIsActive
);

router.get("/", getPasswordPolicy);

module.exports = router;
