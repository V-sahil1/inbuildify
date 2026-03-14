const express = require("express");
const router = express.Router();

const {
  createUserGroup,
  getAllUserGroups,
  updateUserGroup,
  updateUserGroupIsActive,
} = require("./user-group.controller");
const {
  createUserGroupSchema,
  getAllUserGroupSchema,
  updateUserGroupParamsSchema,
  updateUserGroupSchema,
} = require("./user-group.validation");

const { validateRequest } = require("../../middleware/validateRequestMiddleware");
const authMiddleware = require("../../middleware/authMiddleware");
const roleMiddleware = require("../../middleware/roleMiddleware");
const camelToSnakeMiddleware = require("../../middleware/caseConverterMiddleware.js");

const { REQUEST_SOURCE } = require("../../config/constants");

router.use(authMiddleware);
router.use(roleMiddleware);
router.use(camelToSnakeMiddleware);

router.post(
  "/",
  validateRequest(createUserGroupSchema, REQUEST_SOURCE.BODY),
  createUserGroup
);

router.get(
  "/",
  validateRequest(getAllUserGroupSchema, REQUEST_SOURCE.QUERY),
  getAllUserGroups
);

router.put(
  "/:id",
  validateRequest(updateUserGroupParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateUserGroupSchema, REQUEST_SOURCE.BODY),
  updateUserGroup
);

router.put(
  "/is-active/:id",
  validateRequest(updateUserGroupParamsSchema, REQUEST_SOURCE.PARAMS),
  updateUserGroupIsActive
);

module.exports = router;
