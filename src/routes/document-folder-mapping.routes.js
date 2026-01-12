const express = require("express");
const router = express.Router();

const {
  
  getAllDocumentFolderMappings,
  updateDocumentFolderMapping,
} = require("../controllers/document-folder-mapping.controller");
const {

  getAllDocumentFolderMappingsSchema,
  updateDocumentFolderMappingSchema,
} = require("../validations/document-folder-mapping.validation");

const { validateRequest } = require("../middleware/validateRequestMiddleware");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const camelToSnakeMiddleware = require("../middleware/caseConverterMiddleware.js");

const { REQUEST_SOURCE } = require("../config/constants");

router.use(authMiddleware);
router.use(roleMiddleware);
router.use(camelToSnakeMiddleware);

router.get(
  "/",
  validateRequest(getAllDocumentFolderMappingsSchema, REQUEST_SOURCE.QUERY),
  getAllDocumentFolderMappings
);

router.put(
  "/",
  validateRequest(updateDocumentFolderMappingSchema, REQUEST_SOURCE.BODY),
  updateDocumentFolderMapping
);


module.exports = router;
