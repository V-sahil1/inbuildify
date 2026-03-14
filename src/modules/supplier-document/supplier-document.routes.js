const express = require("express");
const router = express.Router();

const {
  createSupplierDocument,
  getAllSupplierDocuments,
  updateSupplierDocument,
} = require("./supplier-document.controller.js");
const {
  createSupplierContactSchema,
  getAllSupplierDocumentSchema,
  updateSupplierDocumentParamsSchema,
  updateSupplierDocumentSchema,
} = require("./supplier-document.validation.js");

const { validateRequest } = require("../../middleware/validateRequestMiddleware.js");
const authMiddleware = require("../../middleware/authMiddleware.js");
const roleMiddleware = require("../../middleware/roleMiddleware.js");
const camelToSnakeMiddleware = require("../../middleware/caseConverterMiddleware.js");

const { REQUEST_SOURCE } = require("../../config/constants.js");
const { createUpload, handleMulterError } = require("../../utils/s3Upload.js");

router.use(authMiddleware);
router.use(roleMiddleware);

const upload = createUpload("supplier-document");

router.post(
  "/",
  upload.fields([
    { name: "workCoverImage", maxCount: 1 },
    { name: "plInsuranceImage", maxCount: 1 },
    { name: "whiteCardImage", maxCount: 1 },
    { name: "forkLiftLicenseImage", maxCount: 1 },
    { name: "tradeLicenseImage", maxCount: 1 },
    { name: "inductionPackImage", maxCount: 1 },
  ]),
  handleMulterError,
  camelToSnakeMiddleware,
  validateRequest(createSupplierContactSchema, REQUEST_SOURCE.FORM_DATA),
  createSupplierDocument,
);

router.get(
  "/",
  camelToSnakeMiddleware,
  validateRequest(getAllSupplierDocumentSchema, REQUEST_SOURCE.QUERY),
  getAllSupplierDocuments,
);

router.put(
  "/:id",
  upload.fields([
    { name: "workCoverImage", maxCount: 1 },
    { name: "plInsuranceImage", maxCount: 1 },
    { name: "whiteCardImage", maxCount: 1 },
    { name: "forkLiftLicenseImage", maxCount: 1 },
    { name: "tradeLicenseImage", maxCount: 1 },
    { name: "inductionPackImage", maxCount: 1 },
  ]),
  handleMulterError,
  camelToSnakeMiddleware,
  validateRequest(updateSupplierDocumentParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateSupplierDocumentSchema, REQUEST_SOURCE.FORM_DATA),
  updateSupplierDocument,
);
module.exports = router;
