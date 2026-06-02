import express from "express";

const router = express.Router();

import {
  updateIntegrationSettings,
  getUserIntegrationSettings,
} from "./integration-setting.controller.js";
import { updateIntegrationSettingSchema } from "./integration-setting.validation.js";
import { validateRequest } from "../../middleware/validateRequestMiddleware.js";
import authMiddleware from "../../middleware/authMiddleware.js";
import roleMiddleware from "../../middleware/roleMiddleware.js";
import camelToSnakeMiddleware from "../../middleware/caseConverterMiddleware.js";
import { REQUEST_SOURCE } from "../../config/constants.js";

router.use(authMiddleware);
router.use(roleMiddleware);
router.use(camelToSnakeMiddleware);

router.get("/", getUserIntegrationSettings);

router.put(
  "/",
  validateRequest(updateIntegrationSettingSchema, REQUEST_SOURCE.BODY),
  updateIntegrationSettings,
);

export default router;
