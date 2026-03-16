import express from "express";

const router = express.Router();

import {
  createUserGroup,
  getAllUserGroups,
  updateUserGroup,
  updateUserGroupIsActive,
} from "./user-group.controller";
import {
  createUserGroupSchema,
  getAllUserGroupSchema,
  updateUserGroupParamsSchema,
  updateUserGroupSchema,
} from "./user-group.validation";
import { validateRequest } from "../../middleware/validateRequestMiddleware";
import authMiddleware from "../../middleware/authMiddleware";
import roleMiddleware from "../../middleware/roleMiddleware";
import camelToSnakeMiddleware from "../../middleware/caseConverterMiddleware.js";
import { REQUEST_SOURCE } from "../../config/constants";

router.use(authMiddleware);
router.use(roleMiddleware);
router.use(camelToSnakeMiddleware);

router.post(
  "/",
  validateRequest(createUserGroupSchema, REQUEST_SOURCE.BODY),
  createUserGroup,
);

router.get(
  "/",
  validateRequest(getAllUserGroupSchema, REQUEST_SOURCE.QUERY),
  getAllUserGroups,
);

router.put(
  "/:id",
  validateRequest(updateUserGroupParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateUserGroupSchema, REQUEST_SOURCE.BODY),
  updateUserGroup,
);

router.put(
  "/is-active/:id",
  validateRequest(updateUserGroupParamsSchema, REQUEST_SOURCE.PARAMS),
  updateUserGroupIsActive,
);

export default router;
