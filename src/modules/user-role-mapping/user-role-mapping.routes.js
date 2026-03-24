import express from "express";

const router = express.Router();

import {
  createUserRoleMapping,
  getAllUserRoleMapping,
  deleteUserRoleMapping,
  updateUserRoleMapping,
} from "./user-role-mapping.controller.js";
import {
  createUserRoleMappingSchema,
  getAllUserRoleMappingSchema,
  deleteUserRoleMppingSchema,
  updateUserRoleMppingParamsSchema,
  updateUserRoleMappingSchema,
} from "./user-role-mapping.validation.js";
import { validateRequest } from "../../middleware/validateRequestMiddleware.js";
import authMiddleware from "../../middleware/authMiddleware.js";
import roleMiddleware from "../../middleware/roleMiddleware.js";
import camelToSnakeMiddleware from "../../middleware/caseConverterMiddleware.js";
import { REQUEST_SOURCE } from "../../config/constants.js";

router.use(authMiddleware);
router.use(roleMiddleware);
router.use(camelToSnakeMiddleware);

router.post(
  "/",
  validateRequest(createUserRoleMappingSchema, REQUEST_SOURCE.BODY),
  createUserRoleMapping,
);

router.get(
  "/",
  validateRequest(getAllUserRoleMappingSchema, REQUEST_SOURCE.QUERY),
  getAllUserRoleMapping,
);

router.delete(
  "/:user_role_mapping_id",
  validateRequest(deleteUserRoleMppingSchema, REQUEST_SOURCE.PARAMS),
  deleteUserRoleMapping,
);

router.put(
  "/:user_role_mapping_id",
  validateRequest(updateUserRoleMppingParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateUserRoleMappingSchema, REQUEST_SOURCE.BODY),
  updateUserRoleMapping,
);

export default router;
