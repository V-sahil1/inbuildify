const express = require("express");
const router = express.Router();

const {
  createUserRoleMapping,
  getAllUserRoleMapping,
  deleteUserRoleMapping,
  updateUserRoleMapping,
} = require("../controllers/user-role-mapping.controller");

const {
  createUserRoleMappingSchema,
  getAllUserRoleMappingSchema,
  deleteUserRoleMppingSchema,
  updateUserRoleMppingParamsSchema,
  updateUserRoleMappingSchema,
} = require("../validations/user-role-mapping.validation");

const { validateRequest } = require("../middleware/validateRequestMiddleware");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const { REQUEST_SOURCE } = require("../config/constants");

router.use(authMiddleware);
router.use(roleMiddleware);

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
