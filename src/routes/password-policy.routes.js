const express = require("express");
const router = express.Router();

const {
  createPasswordPolicy,
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
const camelToSnakeMiddleware = require("../middleware/caseConverterMiddleware.js");

const { REQUEST_SOURCE } = require("../config/constants");

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
