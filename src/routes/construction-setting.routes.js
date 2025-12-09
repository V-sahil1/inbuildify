const express = require("express");
const router = express.Router();

const {
  createConstructionSettings,
  getConstructionSettings,
  updateConstructionSettings,
} = require("../controllers/construction-setting.controller");
const {
  createConstructionSettingSchema,
  updateConstructionSettingParamsSchema,
  updateConstructionSettingSchema,
} = require("../validations/construction-setting.validation");

const { validateRequest } = require("../middleware/validateRequestMiddleware");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

const { REQUEST_SOURCE } = require("../config/constants");

router.use(authMiddleware);
router.use(roleMiddleware);

router.post(
  "/",
  validateRequest(createConstructionSettingSchema, REQUEST_SOURCE.BODY),
  createConstructionSettings
);

router.get("/", getConstructionSettings);

router.put(
  "/:id",
  validateRequest(updateConstructionSettingParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateConstructionSettingSchema, REQUEST_SOURCE.BODY),
  updateConstructionSettings
);

module.exports = router;
