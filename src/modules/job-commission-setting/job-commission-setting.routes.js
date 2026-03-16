import express from "express";

const router = express.Router();

import {
  createJobCommissionSettings,
  updateJobCommissionSettings,
  getUserJobCommissionSettings,
} from "./job-commission-setting.controller.js";
import {
  createJobCommissionSettingSchema,
  updateJobCommissionSettingParamsSchema,
  updateJobCommissionSettingSchema,
} from "./job-commission-setting.validation.js";
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
  validateRequest(createJobCommissionSettingSchema, REQUEST_SOURCE.BODY),
  createJobCommissionSettings,
);

router.get("/", getUserJobCommissionSettings);

router.put(
  "/",
  validateRequest(updateJobCommissionSettingSchema, REQUEST_SOURCE.BODY),
  updateJobCommissionSettings,
);
export default router;
