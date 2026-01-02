const express = require("express");
const router = express.Router();

const {
  createPortalSettings,
  getPortalSettings,
  updatePortalSettings,
} = require("../controllers/portal-setting.controller");
const {
  createPortalSettingsSchema,
  updatePortalSettingParamsSchema,
  updatePortalSettingsSchema,
} = require("../validations/portal-setting.validation");

const { validateRequest } = require("../middleware/validateRequestMiddleware");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const camelToSnakeMiddleware = require("../middleware/caseConverterMiddleware.js");

const { createUpload, handleMulterError } = require("../utils/s3Upload");

const { REQUEST_SOURCE } = require("../config/constants");

router.use(authMiddleware);
router.use(roleMiddleware);

const upload = createUpload("portal-setting");

router.post(
  "/",
  upload.single("default_facade_image"),
  handleMulterError,
  camelToSnakeMiddleware,
  validateRequest(createPortalSettingsSchema, REQUEST_SOURCE.FORM_DATA),
  createPortalSettings
);

router.get("/", getPortalSettings);

router.put(
  "/",
  upload.single("defaultFacadeImage"),
  handleMulterError,
  camelToSnakeMiddleware,
  validateRequest(updatePortalSettingsSchema, REQUEST_SOURCE.BODY),
  updatePortalSettings
);
module.exports = router;
