const express = require("express");
const router = express.Router();

const {
  getEstateImages,
  updateEstateImage,
  getEstateDocuments,
  updateEstateDocument,
} = require("../controllers/estate-document-image.controller");

const {
  updateEstateImageSchema,
  updateEstateDocumentSchema,
} = require("../validations/estate-document-image.validation");

const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const camelToSnakeMiddleware = require("../middleware/caseConverterMiddleware.js");

const { validateRequest } = require("../middleware/validateRequestMiddleware");
const { REQUEST_SOURCE } = require("../config/constants");
const { createUpload, handleMulterError } = require("../utils/s3Upload");

router.use(authMiddleware);
router.use(roleMiddleware);

// Configure S3 upload for estate files
const upload = createUpload("estate-image");
const uploadDocument = createUpload("estate-document");

/* -----------------------------
   ESTATE IMAGES ROUTES
------------------------------ */

router.get("/image", getEstateImages);

router.put(
  "/image/:id",
  upload.single("imageUrl"),
  handleMulterError,
  camelToSnakeMiddleware,
  validateRequest(updateEstateImageSchema, REQUEST_SOURCE.FORM_DATA),
  updateEstateImage
);

/* -----------------------------
   ESTATE DOCUMENTS ROUTES
------------------------------ */

router.get("/documents", getEstateDocuments);

router.put(
  "/documents/:id",
  uploadDocument.single("fileUrl"),
  handleMulterError,
  camelToSnakeMiddleware,
  validateRequest(updateEstateDocumentSchema, REQUEST_SOURCE.FORM_DATA),
  updateEstateDocument
);

module.exports = router;
