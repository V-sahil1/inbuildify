const express = require("express");
const router = express.Router();

const {
  createDocumentCommonFolder,
  getAllDocumentCommonFolders,
  deleteDocumentCommonFolder,
  updateDocumentCommonFolder,
} = require("./document-common-folder.controller.js");
const {
  createDocumentCommonFolderSchema,
  getAllDocumentCommonFolderSchema,
  deleteDocumentCommonFolderSchema,
  updateDocumentCommonFolderParamsSchema,
  updateDocumentCommonFolderSchema,
} = require("./document-common-folder.validation.js");

const { validateRequest } = require("../../middleware/validateRequestMiddleware.js");
const authMiddleware = require("../../middleware/authMiddleware.js");
const roleMiddleware = require("../../middleware/roleMiddleware.js");
const camelToSnakeMiddleware = require("../../middleware/caseConverterMiddleware.js");

const { REQUEST_SOURCE } = require("../../config/constants.js");

router.use(authMiddleware);
router.use(roleMiddleware);
router.use(camelToSnakeMiddleware);

router.post(
  "/",
  validateRequest(createDocumentCommonFolderSchema, REQUEST_SOURCE.BODY),
  createDocumentCommonFolder
);

router.get(
  "/",
  validateRequest(getAllDocumentCommonFolderSchema, REQUEST_SOURCE.QUERY),
  getAllDocumentCommonFolders
);

router.delete(
  "/:document_common_folder_id",
  validateRequest(deleteDocumentCommonFolderSchema, REQUEST_SOURCE.PARAMS),
  deleteDocumentCommonFolder
);

router.put(
  "/:document_common_folder_id",
  validateRequest(
    updateDocumentCommonFolderParamsSchema,
    REQUEST_SOURCE.PARAMS
  ),
  validateRequest(updateDocumentCommonFolderSchema, REQUEST_SOURCE.BODY),
  updateDocumentCommonFolder
);

module.exports = router;
