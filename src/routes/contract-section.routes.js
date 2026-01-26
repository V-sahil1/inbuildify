const express = require("express");
const router = express.Router();

const {
  createContractSection,
  getAllContractSections,
  getContractSectionById,
  updateContractSection,
  deleteContractSection,
} = require("../controllers/contract-section.controller");
const {
  createContractSectionSchema,
  getAllContractSectionsSchema,
  getContractSectionByIdSchema,
  updateContractSectionParamsSchema,
  updateContractSectionSchema,
  deleteContractSectionSchema,
} = require("../validations/contract-section.validation");

const { validateRequest } = require("../middleware/validateRequestMiddleware");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const camelToSnakeMiddleware = require("../middleware/caseConverterMiddleware.js");
const { createUpload, handleMulterError } = require("../utils/s3Upload");

const { REQUEST_SOURCE } = require("../config/constants");

router.use(authMiddleware);
router.use(roleMiddleware);

const upload = createUpload("contract-section");

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
