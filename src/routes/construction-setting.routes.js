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
const camelToSnakeMiddleware = require("../middleware/caseConverterMiddleware.js");

const { REQUEST_SOURCE } = require("../config/constants");

router.use(authMiddleware);
router.use(roleMiddleware);
router.use(camelToSnakeMiddleware);

router.post(
  "/",
  validateRequest(createConstructionSettingSchema, REQUEST_SOURCE.BODY),
  createConstructionSettings
);

router.get("/", getConstructionSettings);

router.put(
  "/",
  validateRequest(updateConstructionSettingSchema, REQUEST_SOURCE.BODY),
  updateConstructionSettings
);

module.exports = router;
