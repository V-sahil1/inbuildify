const express = require("express");
const router = express.Router();

const {
  createRoleType,
  getRoleTypes,
} = require("../controllers/role-type.controller");
const {
  createRoleTypeSchema,
  getRoleTypeSchema,
} = require("../validations/role-type.validation");

const { validateRequest } = require("../middleware/validateRequestMiddleware");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

const { REQUEST_SOURCE } = require("../config/constants");

router.use(authMiddleware);
router.use(roleMiddleware);

router.post(
  "/",
  validateRequest(createRoleTypeSchema, REQUEST_SOURCE.BODY),
  createRoleType
);

router.get(
  "/",
  validateRequest(getRoleTypeSchema, REQUEST_SOURCE.QUERY),
  getRoleTypes
);

module.exports = router;
