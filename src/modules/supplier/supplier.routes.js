const express = require("express");
const router = express.Router();

const {
  createSupplier,
  getAllSuppliers,
  deleteSupplier,
  updateSupplier,
} = require("./supplier.controller.js");
const {
  createSupplierSchema,
  getAllSupplierSchema,
  deleteSupplierSchema,
  updateSupplierParamsSchema,
  updateSupplierSchema,
} = require("./supplier.validation.js");

const { validateRequest } = require("../../middleware/validateRequestMiddleware.js");
const authMiddleware = require("../../middleware/authMiddleware.js");
const roleMiddleware = require("../../middleware/roleMiddleware.js");
const camelToSnakeMiddleware = require("../../middleware/caseConverterMiddleware.js");
const { REQUEST_SOURCE } = require("../../config/constants.js");
const { createUpload, handleMulterError } = require("../../utils/s3Upload.js");

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
    { name: "workCoverUrl", maxCount: 1 },
    { name: "plInsuranceUrl", maxCount: 1 },
    { name: "whiteCardUrl", maxCount: 1 },
    { name: "forkLiftLicenseUrl", maxCount: 1 },
    { name: "tradeLicenseUrl", maxCount: 1 },
    { name: "inductionPackUrl", maxCount: 1 },
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
    { name: "workCoverUrl", maxCount: 1 },
    { name: "plInsuranceUrl", maxCount: 1 },
    { name: "whiteCardUrl", maxCount: 1 },
    { name: "forkLiftLicenseUrl", maxCount: 1 },
    { name: "tradeLicenseUrl", maxCount: 1 },
    { name: "inductionPackUrl", maxCount: 1 },
  ]),
  handleMulterError,
  camelToSnakeMiddleware,
  validateRequest(updateSupplierParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateSupplierSchema, REQUEST_SOURCE.FORM_DATA),
  updateSupplier,
);

module.exports = router;
