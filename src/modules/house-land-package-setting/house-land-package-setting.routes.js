const express = require("express");
const router = express.Router();

const {
  createHouseLandPackageSetting,
  getHouseLandPackagesetting,
  updateHouseLandPackageSetting,
  getHouseLandPackageSettings,
} = require("./house-land-package-setting.controller.js");
const {
  createHouseLandPackageSettingSchema,
  updateHouseLandPackageSettingParamsSchema,
  updateHouseLandPackageSettingSchems,
} = require("./house-land-package-setting.validation.js");
const { validateRequest } = require("../../middleware/validateRequestMiddleware.js");
const authMiddleware = require("../../middleware/authMiddleware.js");
const roleMiddleware = require("../../middleware/roleMiddleware.js");
const camelToSnakeMiddleware = require("../../middleware/caseConverterMiddleware.js");

const { REQUEST_SOURCE } = require("../../config/constants.js");

router.use(authMiddleware);
router.use(roleMiddleware);
router.use(camelToSnakeMiddleware);

router.post(
  "/",
  validateRequest(createHouseLandPackageSettingSchema, REQUEST_SOURCE.BODY),
  createHouseLandPackageSetting
);

router.get("/fetch", getHouseLandPackageSettings);

router.get("/", getHouseLandPackagesetting);

router.put(
  "/:id",
  validateRequest(
    updateHouseLandPackageSettingParamsSchema,
    REQUEST_SOURCE.PARAMS
  ),
  validateRequest(updateHouseLandPackageSettingSchems, REQUEST_SOURCE.BODY),
  updateHouseLandPackageSetting
);

module.exports = router;
