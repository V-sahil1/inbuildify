const express = require("express");
const router = express.Router();

const {
  createJobVariationSettings,
  getJobVariationSettings,
  updateJobVariationSettings,
} = require("../controllers/job-variation-setting.controller");
const {
  createJobVariationSettingSchema,
  updateJobVariationSettingParamsSchema,
  updateJobVariationSettingSchema,
} = require("../validations/job-variation-setting.validation");

const { validateRequest } = require("../middleware/validateRequestMiddleware");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

const { REQUEST_SOURCE } = require("../config/constants");

router.use(authMiddleware);
router.use(roleMiddleware);

router.post(
  "/",
  validateRequest(createJobVariationSettingSchema, REQUEST_SOURCE.BODY),
  createJobVariationSettings
);

router.get("/", getJobVariationSettings);

router.put(
  "/:id",
  validateRequest(updateJobVariationSettingParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateJobVariationSettingSchema, REQUEST_SOURCE.BODY),
  updateJobVariationSettings
);

module.exports = router;
