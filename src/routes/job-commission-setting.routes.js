const express = require("express");
const router = express.Router();

const {
  createJobCommissionSettings,
  updateJobCommissionSettings,
  getUserJobCommissionSettings,
} = require("../controllers/job-commission-setting.controller");
const {
  createJobCommissionSettingSchema,
  updateJobCommissionSettingParamsSchema,
  updateJobCommissionSettingSchema,
} = require("../validations/job-commission-setting.validation");

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
  validateRequest(createJobCommissionSettingSchema, REQUEST_SOURCE.BODY),
  createJobCommissionSettings
);

router.get("/", getUserJobCommissionSettings);

router.put(
  "/",
  validateRequest(updateJobCommissionSettingSchema, REQUEST_SOURCE.BODY),
  updateJobCommissionSettings
);
module.exports = router;
