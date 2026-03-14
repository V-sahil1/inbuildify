const express = require("express");
const router = express.Router();

const {
  createRoleType,
  getRoleTypes,
  getAllRoleTypes,
} = require("./role-type.controller.js");
const {
  createRoleTypeSchema,
  getRoleTypeSchema,
  getAllRoletypeschema,
} = require("./role-type.validation.js");

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
