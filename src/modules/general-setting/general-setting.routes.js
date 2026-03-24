import express from "express";

const router = express.Router();

import { createGeneralSetting, updateGeneralSettings, getUserGeneralSettings } from "./general-setting.controller.js";
import { createGeneralSettigSchema, updateGeneralSettingsSchema } from "./general-setting.validation.js";
import authMiddleware from "../../middleware/authMiddleware.js";
import roleMiddleware from "../../middleware/roleMiddleware.js";
import camelToSnakeMiddleware from "../../middleware/caseConverterMiddleware.js";
import { validateRequest } from "../../middleware/validateRequestMiddleware.js";
import { REQUEST_SOURCE } from "../../config/constants.js";

router.use(authMiddleware);
router.use(roleMiddleware);
router.use(camelToSnakeMiddleware);

router.post(
  "/",
  validateRequest(createGeneralSettigSchema, REQUEST_SOURCE.BODY),
  createGeneralSetting,
);

router.put(
  "/",
  validateRequest(updateGeneralSettingsSchema, REQUEST_SOURCE.BODY),
  updateGeneralSettings,
);

router.get("/user", getUserGeneralSettings);

export default router;
