const express = require("express");
const router = express.Router();

const {
  createDocumentFolderMapping,
  getAllDocumentFolderMappings,
  updateDocumentFolderMapping,
  deleteDocumentFolderMapping,
} = require("../controllers/document-folder-mapping.controller");
const {
  createDocumentFolderMappingSchema,
  getAllDocumentFolderMappingsSchema,
  updateDocumentFolderMappingParamsSchema,
  updateDocumentFolderMappingSchema,
  deleteDocumentFolderMappingSchema,
} = require("../validations/document-folder-mapping.validation");

const { validateRequest } = require("../middleware/validateRequestMiddleware");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

const { REQUEST_SOURCE } = require("../config/constants");

router.use(authMiddleware);
router.use(roleMiddleware);

router.post(
  "/",
  validateRequest(createDocumentFolderMappingSchema, REQUEST_SOURCE.BODY),
  createDocumentFolderMapping
);

router.get(
  "/",
  validateRequest(getAllDocumentFolderMappingsSchema, REQUEST_SOURCE.QUERY),
  getAllDocumentFolderMappings
);

router.put(
  "/:document_folder_mapping_id",
  validateRequest(
    updateDocumentFolderMappingParamsSchema,
    REQUEST_SOURCE.PARAMS
  ),
  validateRequest(updateDocumentFolderMappingSchema, REQUEST_SOURCE.BODY),
  updateDocumentFolderMapping
);

router.delete(
  "/:document_folder_mapping_id",
  validateRequest(deleteDocumentFolderMappingSchema, REQUEST_SOURCE.PARAMS),
  deleteDocumentFolderMapping
);

module.exports = router;
