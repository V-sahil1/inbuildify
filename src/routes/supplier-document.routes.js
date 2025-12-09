const express = require("express");
const router = express.Router();

const {
  createSupplierDocument,
  getAllSupplierDocuments,
  updateSupplierDocument,
} = require("../controllers/supplier-document.controller");
const {
  createSupplierContactSchema,
  getAllSupplierDocumentSchema,
  updateSupplierDocumentParamsSchema,
  updateSupplierDocumentSchema,
} = require("../validations/supplier-document.validation");

const { validateRequest } = require("../middleware/validateRequestMiddleware");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

const { REQUEST_SOURCE } = require("../config/constants");
const { createUpload, handleMulterError } = require("../utils/s3Upload");

router.use(authMiddleware);
router.use(roleMiddleware);

const upload = createUpload("supplier-document");

router.post(
  "/",
  upload.fields([
    { name: "work_cover_image", maxCount: 1 },
    { name: "pl_insurance_image", maxCount: 1 },
    { name: "white_card_image", maxCount: 1 },
    { name: "fork_lift_license_image", maxCount: 1 },
    { name: "trade_license_image", maxCount: 1 },
    { name: "induction_pack_image", maxCount: 1 },
  ]),
  handleMulterError,
  validateRequest(createSupplierContactSchema, REQUEST_SOURCE.FORM_DATA),
  createSupplierDocument
);

router.get(
  "/",
  validateRequest(getAllSupplierDocumentSchema, REQUEST_SOURCE.QUERY),
  getAllSupplierDocuments
);

router.put(
  "/:id",
  upload.fields([
    { name: "work_cover_image", maxCount: 1 },
    { name: "pl_insurance_image", maxCount: 1 },
    { name: "white_card_image", maxCount: 1 },
    { name: "fork_lift_license_image", maxCount: 1 },
    { name: "trade_license_image", maxCount: 1 },
    { name: "induction_pack_image", maxCount: 1 },
  ]),
  handleMulterError,
  validateRequest(updateSupplierDocumentParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateSupplierDocumentSchema, REQUEST_SOURCE.FORM_DATA),
  updateSupplierDocument
);
module.exports = router;
