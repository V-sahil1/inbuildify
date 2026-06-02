import express from "express";

const router = express.Router();

import { getAllRole } from "./role.controller.js";
import {
  getAllRoleSchema,
} from "./role.validation.js";
import { validateRequest } from "../../middleware/validateRequestMiddleware.js";
import authMiddleware from "../../middleware/authMiddleware.js";
import roleMiddleware from "../../middleware/roleMiddleware.js";
import camelToSnakeMiddleware from "../../middleware/caseConverterMiddleware.js";
import { REQUEST_SOURCE } from "../../config/constants.js";

router.use(camelToSnakeMiddleware);

router.get(
  "/",
  validateRequest(getAllRoleSchema, REQUEST_SOURCE.QUERY),
  getAllRole,
);

export default router;
