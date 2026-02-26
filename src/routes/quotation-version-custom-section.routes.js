const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const camelToSnakeMiddleware = require("../middleware/caseConverterMiddleware.js");

const { validateRequest } = require("../middleware/validateRequestMiddleware");
const { REQUEST_SOURCE } = require("../config/constants");
const {
  createCustomSectionSchema,
  getCustomSectionsByVersionSchema,
  updateCustomSectionSchema,
  customSectionIdParamsSchema,
} = require("../validations/quotation-version-custom-section.validation");
const customSectionController = require("../controllers/quotation-version-custom-section.controller");
const { createPdfUpload, handleMulterError } = require("../utils/s3Upload");

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
