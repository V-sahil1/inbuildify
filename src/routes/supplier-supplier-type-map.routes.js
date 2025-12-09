const express = require("express");
const router = express.Router();

const {
  createSupplierTypeMap,
  getAllSupplierTypeMaps,
  deleteSupplierSupplierTypeMap,
} = require("../controllers/supplier-supplier-type-map.controller");
const {
  createSupplierTypeMapSchema,
  getAllSupplierTypeMapsSchema,
  deleteSupplierSupplierTypeMapSchema,
} = require("../validations/supplier-supplier-type-map.validation");

const { validateRequest } = require("../middleware/validateRequestMiddleware");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

const { REQUEST_SOURCE } = require("../config/constants");

router.use(authMiddleware);
router.use(roleMiddleware);

router.post(
  "/",
  validateRequest(createSupplierTypeMapSchema, REQUEST_SOURCE.BODY),
  createSupplierTypeMap
);

router.get(
  "/",
  validateRequest(getAllSupplierTypeMapsSchema, REQUEST_SOURCE.QUERY),
  getAllSupplierTypeMaps
);

router.delete(
  "/:id",
  validateRequest(deleteSupplierSupplierTypeMapSchema, REQUEST_SOURCE.PARAMS),
  deleteSupplierSupplierTypeMap
);
module.exports = router;
