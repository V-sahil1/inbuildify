import express from "express";

const router = express.Router();

import { createJobColorSettingSchema, updateJobColorSettingSchema } from "./job-color-setting.validation.js";
import { createJobColorSettings, updateJobColorSetting, getUserJobColorSettings } from "./job-color-setting.controller.js";
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
  validateRequest(createJobColorSettingSchema, REQUEST_SOURCE.BODY),
  createJobColorSettings,
);

router.get("/", getUserJobColorSettings);

router.put(
  "/",
  validateRequest(updateJobColorSettingSchema, REQUEST_SOURCE.BODY),
  updateJobColorSetting,
);

export default router;
