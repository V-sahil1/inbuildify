const express = require("express");
const router = express.Router();

const {
  createRoleType,
  getRoleTypes,
  getAllRoleTypes,
} = require("../controllers/role-type.controller");
const {
  createRoleTypeSchema,
  getRoleTypeSchema,
  getAllRoletypeschema,
} = require("../validations/role-type.validation");

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
  validateRequest(createRoleTypeSchema, REQUEST_SOURCE.BODY),
  createRoleType
);

router.get(
  "/",
  validateRequest(getRoleTypeSchema, REQUEST_SOURCE.QUERY),
  getRoleTypes
);

router.get(
  "/all",
  validateRequest(getAllRoletypeschema, REQUEST_SOURCE.QUERY),
  getAllRoleTypes
);

module.exports = router;
