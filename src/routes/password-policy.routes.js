const express = require("express");
const router = express.Router();

const {
  createPasswordPolicy,
  getPasswordPolicyByUser,
  updatePasswordPolicy,
  updatePasswordPolicyIsActive,
  getPasswordPolicy,
} = require("../controllers/password-policy.controller");
const {
  cretePasswordPolicySchema,
  updatePasswordPolicyIdParamsSchema,
  updatePasswordPolicySchema,
  updatePasswordPolicyIsActiveSchema,
} = require("../validations/password-policy.validation");

const { validateRequest } = require("../middleware/validateRequestMiddleware");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const { REQUEST_SOURCE } = require("../config/constants");

router.use(authMiddleware);
router.use(roleMiddleware);

router.post(
  "/",
  validateRequest(cretePasswordPolicySchema, REQUEST_SOURCE.BODY),
  createPasswordPolicy
);

router.get("/", getPasswordPolicyByUser);

router.put(
  "/:password_policy_id",
  validateRequest(updatePasswordPolicyIdParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updatePasswordPolicySchema, REQUEST_SOURCE.BODY),
  updatePasswordPolicy
);

router.put(
  "/is-active/:password_policy_id",
  validateRequest(updatePasswordPolicyIdParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updatePasswordPolicyIsActiveSchema, REQUEST_SOURCE.BODY),
  updatePasswordPolicyIsActive
);

router.get("/user", getPasswordPolicy);

module.exports = router;
