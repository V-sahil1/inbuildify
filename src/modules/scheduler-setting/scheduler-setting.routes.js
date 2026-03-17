import express from "express";

const router = express.Router();

import { createSchedulerSettings, getSchedulerSettings, updateSchedulerSettings } from "./scheduler-setting.controller.js";
import { createSchedulerSettingsSchema, updateSchedulerSettingSchema } from "./scheduler-setting.validation.js";
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
  validateRequest(createSchedulerSettingsSchema, REQUEST_SOURCE.BODY),
  createSchedulerSettings,
);

router.get("/", getSchedulerSettings);

router.put(
  "/",
  validateRequest(updateSchedulerSettingSchema, REQUEST_SOURCE.BODY),
  updateSchedulerSettings,
);

export default router;
