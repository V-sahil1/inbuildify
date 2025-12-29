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

router.use(authMiddleware);
router.use(roleMiddleware);
router.use(camelToSnakeMiddleware);

router.post(
  "/",
  validateRequest(createSupplierSchema, REQUEST_SOURCE.BODY),
  createSupplier
);

router.get(
  "/",
  validateRequest(getAllSupplierSchema, REQUEST_SOURCE.QUERY),
  getAllSuppliers
);

router.delete(
  "/:supplier_id",
  validateRequest(deleteSupplierSchema, REQUEST_SOURCE.PARAMS),
  deleteSupplier
);

router.put(
  "/:supplier_id",
  validateRequest(updateSupplierParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateSupplierSchema, REQUEST_SOURCE.BODY),
  updateSupplier
);
module.exports = router;
