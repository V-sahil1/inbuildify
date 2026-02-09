const express = require("express");
const router = express.Router();

const {
  createSupplier,
  getAllSuppliers,
  deleteSupplier,
  updateSupplier,
} = require("../controllers/supplier.controller");
const {
  createSupplierSchema,
  getAllSupplierSchema,
  deleteSupplierSchema,
  updateSupplierParamsSchema,
  updateSupplierSchema,
} = require("../validations/supplier.validation");

const { validateRequest } = require("../middleware/validateRequestMiddleware");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const camelToSnakeMiddleware = require("../middleware/caseConverterMiddleware.js");
const { REQUEST_SOURCE } = require("../config/constants");
const { createUpload, handleMulterError } = require("../utils/s3Upload");

const upload = createUpload("supplier");

router.use(authMiddleware);
router.use(roleMiddleware);

// Custom middleware to parse JSON strings in form data
const parseJsonFields = (req, res, next) => {
  const jsonFields = ["contacts"];

  for (const field of jsonFields) {
    if (req.body[field] && typeof req.body[field] === "string") {
      try {
        req.body[field] = JSON.parse(req.body[field]);
      } catch (e) {
        return res.status(400).json({
          success: false,
          message: `Invalid ${field} format. Must be valid JSON array.`,
        });
      }
    }
  }
  next();
};

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
  parseJsonFields,
  camelToSnakeMiddleware,
  validateRequest(createSupplierSchema, REQUEST_SOURCE.FORM_DATA),
  createSupplier,
);

router.get(
  "/",
  camelToSnakeMiddleware,
  validateRequest(getAllSupplierSchema, REQUEST_SOURCE.QUERY),
  getAllSuppliers,
);

router.delete(
  "/:supplier_id",
  camelToSnakeMiddleware,
  validateRequest(deleteSupplierSchema, REQUEST_SOURCE.PARAMS),
  deleteSupplier,
);

router.put(
  "/:supplier_id",
  upload.fields([
    { name: "workCoverImage", maxCount: 1 },
    { name: "plInsuranceImage", maxCount: 1 },
    { name: "whiteCardImage", maxCount: 1 },
    { name: "forkLiftLicenseImage", maxCount: 1 },
    { name: "tradeLicenseImage", maxCount: 1 },
    { name: "inductionPackImage", maxCount: 1 },
  ]),
  handleMulterError,
  parseJsonFields,
  camelToSnakeMiddleware,
  validateRequest(updateSupplierParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateSupplierSchema, REQUEST_SOURCE.FORM_DATA),
  updateSupplier,
);

module.exports = router;
