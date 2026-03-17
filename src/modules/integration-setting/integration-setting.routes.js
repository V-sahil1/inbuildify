import express from "express";

const router = express.Router();

import {
  createIntegrationSettings,
  updateIntegrationSettings,
  getUserIntegrationSettings,
} from "./integration-setting.controller.js";
import { createIntegrationSettingsSchema, updateIntegrationSettingSchema } from "./integration-setting.validation.js";
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
  validateRequest(createIntegrationSettingsSchema, REQUEST_SOURCE.BODY),
  createIntegrationSettings,
);

router.get("/", getUserIntegrationSettings);

router.put(
  "/",
  validateRequest(updateIntegrationSettingSchema, REQUEST_SOURCE.BODY),
  updateIntegrationSettings,
);

export default router;
