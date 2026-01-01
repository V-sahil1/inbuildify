const express = require("express");
const router = express.Router();

const {
  createJobColorSettingSchema,
  updateJobColorSettingParamsSchema,
  updateJobColorSettingSchema,
} = require("../validations/job-color-setting.validation");
const {
  createJobColorSettings,
  updateJobColorSetting,
  getUserJobColorSettings,
} = require("../controllers/job-color-setting.controller");
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
  validateRequest(createJobColorSettingSchema, REQUEST_SOURCE.BODY),
  createJobColorSettings
);

router.get("/", getUserJobColorSettings);

router.put(
  "/",
  validateRequest(updateJobColorSettingSchema, REQUEST_SOURCE.BODY),
  updateJobColorSetting
);

module.exports = router;
