const express = require("express");
const router = express.Router();

const authMiddleware = require("../../middleware/authMiddleware.js");
const roleMiddleware = require("../../middleware/roleMiddleware.js");
const camelToSnakeMiddleware = require("../../middleware/caseConverterMiddleware.js");

const { validateRequest } = require("../../middleware/validateRequestMiddleware.js");
const { REQUEST_SOURCE } = require("../../config/constants.js");
const {
  createCustomSectionSchema,
  getCustomSectionsByVersionSchema,
  updateCustomSectionSchema,
  customSectionIdParamsSchema,
} = require("./quotation-version-custom-section.validation.js");
const customSectionController = require("./quotation-version-custom-section.controller.js");
const { createPdfUpload, handleMulterError } = require("../../utils/s3Upload.js");

const upload = createPdfUpload("quotation-custom-section");

router.use(authMiddleware);
router.use(roleMiddleware);

router.post(
  "/",
  upload.single("fileUrl"),
  handleMulterError,
  camelToSnakeMiddleware,
  validateRequest(createCustomSectionSchema, REQUEST_SOURCE.FORM_DATA),
  customSectionController.createCustomSection
);

router.get(
  "/:quotation_version_id",
  validateRequest(getCustomSectionsByVersionSchema, REQUEST_SOURCE.PARAMS),
  customSectionController.getCustomSectionsByVersionId
);

router.put(
  "/:custom_section_id",
  upload.single("fileUrl"),
  handleMulterError,
  camelToSnakeMiddleware,
  validateRequest(customSectionIdParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateCustomSectionSchema, REQUEST_SOURCE.FORM_DATA),
  customSectionController.updateCustomSection
);

router.delete(
  "/:custom_section_id",
  validateRequest(customSectionIdParamsSchema, REQUEST_SOURCE.PARAMS),
  customSectionController.deleteCustomSection
);

module.exports = router;
