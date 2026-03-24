import express from "express";

const router = express.Router();

import {
  createConstructionSettings,
  getConstructionSettings,
  updateConstructionSettings,
} from "./construction-setting.controller.js";
import { createConstructionSettingSchema, updateConstructionSettingSchema } from "./construction-setting.validation.js";
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
  validateRequest(createConstructionSettingSchema, REQUEST_SOURCE.BODY),
  createConstructionSettings,
);

router.get("/", getConstructionSettings);

router.put(
  "/",
  validateRequest(updateConstructionSettingSchema, REQUEST_SOURCE.BODY),
  updateConstructionSettings,
);

export default router;
