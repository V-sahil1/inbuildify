import express from "express";

const router = express.Router();

import { createJobSettings, updateJobSettings, getUserJobSettings } from "./job-setting.controller.js";
import { createJobSettingsSchema, updateJobSettingSchema } from "./job-setting.validation.js";
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
  validateRequest(createJobSettingsSchema, REQUEST_SOURCE.BODY),
  createJobSettings,
);

router.get("/", getUserJobSettings);

router.put(
  "/",
  validateRequest(updateJobSettingSchema, REQUEST_SOURCE.BODY),
  updateJobSettings,
);

export default router;
