const express = require("express");
const router = express.Router();

const {
  createJobSettings,
  updateJobSettings,
  getUserJobSettings,
} = require("../controllers/job-setting.controller");
const {
  createJobSettingsSchema,
  updateJobSettingSchema,
} = require("../validations/job-setting.validation");

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
  validateRequest(createJobSettingsSchema, REQUEST_SOURCE.BODY),
  createJobSettings
);

router.get("/", getUserJobSettings);

router.put(
  "/",
  validateRequest(updateJobSettingSchema, REQUEST_SOURCE.BODY),
  updateJobSettings
);

module.exports = router;
