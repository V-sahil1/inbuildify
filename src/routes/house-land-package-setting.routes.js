const express = require("express");
const router = express.Router();

const {
  createHouseLandPackageSetting,
  getHouseLandPackagesetting,
  updateHouseLandPackageSetting,
  getHouseLandPackageSettings,
} = require("../controllers/house-land-package-setting.controller");
const {
  createHouseLandPackageSettingSchema,
  updateHouseLandPackageSettingParamsSchema,
  updateHouseLandPackageSettingSchems,
} = require("../validations/house-land-package-setting.validation");
const { validateRequest } = require("../middleware/validateRequestMiddleware");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const camelToSnakeMiddleware = require("../middleware/caseConverterMiddleware.js");

const { REQUEST_SOURCE } = require("../config/constants");

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
