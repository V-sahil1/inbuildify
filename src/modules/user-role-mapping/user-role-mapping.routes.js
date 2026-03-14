const express = require("express");
const router = express.Router();

const {
  createUserRoleMapping,
  getAllUserRoleMapping,
  deleteUserRoleMapping,
  updateUserRoleMapping,
} = require("./user-role-mapping.controller.js");

const {
  createUserRoleMappingSchema,
  getAllUserRoleMappingSchema,
  deleteUserRoleMppingSchema,
  updateUserRoleMppingParamsSchema,
  updateUserRoleMappingSchema,
} = require("./user-role-mapping.validation.js");

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
  validateRequest(createUserRoleMappingSchema, REQUEST_SOURCE.BODY),
  createUserRoleMapping
);

router.get(
  "/",
  validateRequest(getAllUserRoleMappingSchema, REQUEST_SOURCE.QUERY),
  getAllUserRoleMapping
);

router.delete(
  "/:user_role_mapping_id",
  validateRequest(deleteUserRoleMppingSchema, REQUEST_SOURCE.PARAMS),
  deleteUserRoleMapping
);

router.put(
  "/:user_role_mapping_id",
  validateRequest(updateUserRoleMppingParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateUserRoleMappingSchema, REQUEST_SOURCE.BODY),
  updateUserRoleMapping
);

module.exports = router;
