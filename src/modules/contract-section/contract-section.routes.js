const express = require("express");
const router = express.Router();

const {
  createContractSection,
  getAllContractSections,
  getContractSectionById,
  updateContractSection,
  deleteContractSection,
} = require("./contract-section.controller.js");
const {
  createContractSectionSchema,
  getAllContractSectionsSchema,
  getContractSectionByIdSchema,
  updateContractSectionParamsSchema,
  updateContractSectionSchema,
  deleteContractSectionSchema,
} = require("./contract-section.validation.js");

const { validateRequest } = require("../../middleware/validateRequestMiddleware.js");
const authMiddleware = require("../../middleware/authMiddleware.js");
const roleMiddleware = require("../../middleware/roleMiddleware.js");
const camelToSnakeMiddleware = require("../../middleware/caseConverterMiddleware.js");
const {
  createUpload,
  handleMulterError,
  createImageOrPdfUpload,
} = require("../../utils/s3Upload.js");

const { REQUEST_SOURCE } = require("../../config/constants.js");

router.use(authMiddleware);
router.use(roleMiddleware);

const upload = createImageOrPdfUpload("contract-section");

router.post(
  "/",
  upload.single("sectionUrl"),
  handleMulterError,
  camelToSnakeMiddleware,
  validateRequest(createContractSectionSchema, REQUEST_SOURCE.FORM_DATA),
  createContractSection,
);

router.get(
  "/",
  validateRequest(getAllContractSectionsSchema, REQUEST_SOURCE.QUERY),
  getAllContractSections,
);

router.get(
  "/:contract_section_id",
  validateRequest(getContractSectionByIdSchema, REQUEST_SOURCE.PARAMS),
  getContractSectionById,
);

router.put(
  "/:contract_section_id",
  upload.single("sectionUrl"),
  handleMulterError,
  camelToSnakeMiddleware,
  validateRequest(updateContractSectionParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateContractSectionSchema, REQUEST_SOURCE.FORM_DATA),
  updateContractSection,
);

router.delete(
  "/:contract_section_id",
  validateRequest(deleteContractSectionSchema, REQUEST_SOURCE.PARAMS),
  deleteContractSection,
);

module.exports = router;
