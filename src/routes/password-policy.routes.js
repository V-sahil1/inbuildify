const express = require("express");
const router = express.Router();

const {
  createPasswordPolicy,
  getPasswordPolicyByUser,
  updatePasswordPolicy,
} = require("../controllers/password-policy.controller");
const {
  cretePasswordPolicySchema,
  updatePasswordPolicyIdParamsSchema,
  updatePasswordPolicySchema,
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

module.exports = router;
