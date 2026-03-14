const express = require("express");
const router = express.Router();

const {
  createSupplierType,
  getAllSupplierType,
  deleteSupplierType,
  updateSupplierType,
  toggleActiveStatus,
} = require("./supplier-type.controller.js");
const {
  createSuppllierTypeSchema,
  getAllSupllierTypeSchema,
  deleteSupplierTypeSchema,
  updateSupplierTypeParamsSchema,
  updateSupplierTypeSchema,
} = require("./supplier-type.validation.js");

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
  validateRequest(createSuppllierTypeSchema, REQUEST_SOURCE.BODY),
  createSupplierType,
);

router.get(
  "/",
  validateRequest(getAllSupllierTypeSchema, REQUEST_SOURCE.QUERY),
  getAllSupplierType,
);

router.delete(
  "/:supplier_type_id",
  validateRequest(deleteSupplierTypeSchema, REQUEST_SOURCE.PARAMS),
  deleteSupplierType,
);

router.put(
  "/:supplier_type_id",
  validateRequest(updateSupplierTypeParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateSupplierTypeSchema, REQUEST_SOURCE.BODY),
  updateSupplierType,
);

router.put(
  "/is-active/:supplier_type_id",
  validateRequest(updateSupplierTypeParamsSchema, REQUEST_SOURCE.PARAMS),
  toggleActiveStatus,
);
module.exports = router;
