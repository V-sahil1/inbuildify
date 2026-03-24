import express from "express";

const router = express.Router();

import { createRole, getAllRole, deleteRole, updateRole } from "./role.controller.js";
import {
  createRoleSchema,
  getAllRoleSchema,
  deleteRoleSchema,
  updateRoleIdParamsSchema,
  updateRoleSchema,
} from "./role.validation.js";
import { validateRequest } from "../../middleware/validateRequestMiddleware.js";
import authMiddleware from "../../middleware/authMiddleware.js";
import roleMiddleware from "../../middleware/roleMiddleware.js";
import camelToSnakeMiddleware from "../../middleware/caseConverterMiddleware.js";
import { REQUEST_SOURCE } from "../../config/constants.js";

router.use(camelToSnakeMiddleware);

router.post(
  "/",
  validateRequest(createRoleSchema, REQUEST_SOURCE.BODY),
  createRole,
);

router.get(
  "/",
  validateRequest(getAllRoleSchema, REQUEST_SOURCE.QUERY),
  getAllRole,
);

router.delete(
  "/:id",
  validateRequest(deleteRoleSchema, REQUEST_SOURCE.PARAMS),
  deleteRole,
);

router.put(
  "/:role_id",
  validateRequest(updateRoleIdParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateRoleSchema, REQUEST_SOURCE.BODY),
  updateRole,
);
export default router;
