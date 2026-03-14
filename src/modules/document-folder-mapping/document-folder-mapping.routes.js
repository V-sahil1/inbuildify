const express = require("express");
const router = express.Router();

const {

  getAllDocumentFolderMappings,
  updateDocumentFolderMapping,
} = require("./document-folder-mapping.controller.js");
const {

  getAllDocumentFolderMappingsSchema,
  updateDocumentFolderMappingSchema,
} = require("./document-folder-mapping.validation.js");

const { validateRequest } = require("../../middleware/validateRequestMiddleware.js");
const authMiddleware = require("../../middleware/authMiddleware.js");
const roleMiddleware = require("../../middleware/roleMiddleware.js");
const camelToSnakeMiddleware = require("../../middleware/caseConverterMiddleware.js");

const { REQUEST_SOURCE } = require("../../config/constants.js");

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
