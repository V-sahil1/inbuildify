import express from "express";

const router = express.Router();

import {
  createHouseLandPackageSetting,
  getHouseLandPackagesetting,
  updateHouseLandPackageSetting,
  getHouseLandPackageSettings,
} from "./house-land-package-setting.controller.js";
import {
  createHouseLandPackageSettingSchema,
  updateHouseLandPackageSettingParamsSchema,
  updateHouseLandPackageSettingSchems,
} from "./house-land-package-setting.validation.js";
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
  validateRequest(createHouseLandPackageSettingSchema, REQUEST_SOURCE.BODY),
  createHouseLandPackageSetting,
);

router.get("/fetch", getHouseLandPackageSettings);

router.get("/", getHouseLandPackagesetting);

router.put(
  "/:id",
  validateRequest(
    updateHouseLandPackageSettingParamsSchema,
    REQUEST_SOURCE.PARAMS,
  ),
  validateRequest(updateHouseLandPackageSettingSchems, REQUEST_SOURCE.BODY),
  updateHouseLandPackageSetting,
);

export default router;
