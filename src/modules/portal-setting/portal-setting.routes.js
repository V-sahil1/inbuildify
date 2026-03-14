const express = require("express");
const router = express.Router();

const {
  createPortalSettings,
  getPortalSettings,
  updatePortalSettings,
} = require("./portal-setting.controller.js");
const {
  createPortalSettingsSchema,
  updatePortalSettingsSchema,
} = require("./portal-setting.validation.js");

const { validateRequest } = require("../../middleware/validateRequestMiddleware.js");
const authMiddleware = require("../../middleware/authMiddleware.js");
const roleMiddleware = require("../../middleware/roleMiddleware.js");
const camelToSnakeMiddleware = require("../../middleware/caseConverterMiddleware.js");

const { createUpload, handleMulterError } = require("../../utils/s3Upload.js");

const { REQUEST_SOURCE } = require("../../config/constants.js");

router.use(authMiddleware);
router.use(roleMiddleware);

const upload = createUpload("portal-setting");

router.post(
  "/",
  upload.single("defaultFacadeImage"),
  handleMulterError,
  camelToSnakeMiddleware,
  validateRequest(createPortalSettingsSchema, REQUEST_SOURCE.FORM_DATA),
  createPortalSettings,
);

router.get("/", getPortalSettings);

router.put(
  "/",
  upload.single("defaultFacadeImage"),
  handleMulterError,
  camelToSnakeMiddleware,
  validateRequest(updatePortalSettingsSchema, REQUEST_SOURCE.FORM_DATA),
  updatePortalSettings,
);
module.exports = router;
