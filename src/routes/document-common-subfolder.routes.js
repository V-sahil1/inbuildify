const express = require("express");
const router = express.Router();

const {
  createDocumentCommonSubfolder,
  getDocumentCommonSubfolderByFolderId,
  deleteDocumentCommonSubfolder,
  updateDocumentCommonSubfolder,
} = require("../controllers/document-common-subfolder.controller");
const {
  createDocumentCommonSubfolderSchem,
  getDocumentCommonSubfolderByFolderIdParamsSchema,
  getDocumentCommonSubfolderByFolderIdSchema,
  deleteDocumentCommonSubfolderSchema,
  updateDocumentCommonSubfolderParamsSchema,
  updateDocumentCommonSubfolderSchema,
} = require("../validations/document-common-subfolder.validation");

const { validateRequest } = require("../middleware/validateRequestMiddleware");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const camelToSnakeMiddleware = require("../middleware/caseConverterMiddleware.js");

const { REQUEST_SOURCE } = require("../config/constants");

router.use(authMiddleware);
router.use(roleMiddleware);
router.use(camelToSnakeMiddleware);

router.post(
  "/",
  validateRequest(createDocumentCommonSubfolderSchem, REQUEST_SOURCE.BODY),
  createDocumentCommonSubfolder
);

router.get(
  "/:document_common_folder_id",
  validateRequest(
    getDocumentCommonSubfolderByFolderIdParamsSchema,
    REQUEST_SOURCE.PARAMS
  ),
  validateRequest(
    getDocumentCommonSubfolderByFolderIdSchema,
    REQUEST_SOURCE.QUERY
  ),
  getDocumentCommonSubfolderByFolderId
);

router.delete(
  "/:document_common_subfolder_id",
  validateRequest(deleteDocumentCommonSubfolderSchema, REQUEST_SOURCE.PARAMS),
  deleteDocumentCommonSubfolder
);

router.put(
  "/:document_common_subfolder_id",
  validateRequest(
    updateDocumentCommonSubfolderParamsSchema,
    REQUEST_SOURCE.PARAMS
  ),
  validateRequest(updateDocumentCommonSubfolderSchema, REQUEST_SOURCE.BODY),
  updateDocumentCommonSubfolder
);

module.exports = router;
