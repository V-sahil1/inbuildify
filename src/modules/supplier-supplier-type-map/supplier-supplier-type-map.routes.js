const express = require("express");
const router = express.Router();

const {
  createSupplierTypeMap,
  getAllSupplierTypeMaps,
  deleteSupplierSupplierTypeMap,
  updateSupplierTypeMap,
  createSupplierTypeConstructionChecklistMap,
  getAllSupplierTypeConstructionChecklistMaps,
  deleteSupplierTypeConstructionChecklistMap,
} = require("./supplier-supplier-type-map.controller.js");
const {
  createSupplierTypeMapSchema,
  getAllSupplierTypeMapsSchema,
  deleteSupplierSupplierTypeMapSchema,
  updateSupplierTypeMapSchema,
  updateSupplierTypeParamsSchema,
  createSupplierTpeChecklistSchema,
} = require("./supplier-supplier-type-map.validation.js");

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
  validateRequest(createSupplierTypeMapSchema, REQUEST_SOURCE.BODY),
  createSupplierTypeMap,
);

router.get(
  "/",
  validateRequest(getAllSupplierTypeMapsSchema, REQUEST_SOURCE.QUERY),
  getAllSupplierTypeMaps,
);

router.delete(
  "/:id",
  validateRequest(deleteSupplierSupplierTypeMapSchema, REQUEST_SOURCE.PARAMS),
  deleteSupplierSupplierTypeMap,
);

router.put(
  "/:id",
  validateRequest(updateSupplierTypeParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateSupplierTypeMapSchema, REQUEST_SOURCE.BODY),
  updateSupplierTypeMap,
);

// supplier type with construction checklist map

router.post(
  "/checklist-map",
  validateRequest(createSupplierTpeChecklistSchema, REQUEST_SOURCE.BODY),
  createSupplierTypeConstructionChecklistMap,
);

router.get(
  "/checklist-map",
  validateRequest(getAllSupplierTypeMapsSchema, REQUEST_SOURCE.QUERY),
  getAllSupplierTypeConstructionChecklistMaps,
);

router.delete(
  "/checklist-map/:id",
  validateRequest(deleteSupplierSupplierTypeMapSchema, REQUEST_SOURCE.PARAMS),
  deleteSupplierTypeConstructionChecklistMap,
);
module.exports = router;
