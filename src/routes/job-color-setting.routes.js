const express = require("express");
const router = express.Router();

const {
  createJobColorSettingSchema,
  updateJobColorSettingParamsSchema,
  updateJobColorSettingSchema,
} = require("../validations/job-color-setting.validation");
const {
  createJobColorSettings,
  getJobColorSetting,
  updateJobColorSetting,
} = require("../controllers/job-color-setting.controller");
const { validateRequest } = require("../middleware/validateRequestMiddleware");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

const { REQUEST_SOURCE } = require("../config/constants");

router.use(authMiddleware);
router.use(roleMiddleware);

router.post(
  "/",
  validateRequest(createJobColorSettingSchema, REQUEST_SOURCE.BODY),
  createJobColorSettings
);

router.get("/", getJobColorSetting);

router.put(
  "/:id",
  validateRequest(updateJobColorSettingParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateJobColorSettingSchema, REQUEST_SOURCE.BODY),
  updateJobColorSetting
);

module.exports = router;
