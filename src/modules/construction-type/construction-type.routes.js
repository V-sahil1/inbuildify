const express = require("express");
const router = express.Router();

const {
  createConstructionType,
  getAllConstructionTypes,
  deleteConstructionType,
  updateConstructionType,
} = require("./construction-type.controller.js");
const {
  createConstructiontyeSchema,
  getAllConstructionTypeSchema,
  deleteConstructionTypeSchema,
  updateConstructionTypeParamsSchema,
  updateConstructionTypeSchema,
} = require("./construction-type.validation.js");

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
  validateRequest(createConstructiontyeSchema, REQUEST_SOURCE.BODY),
  createConstructionType
);

router.get(
  "/",
  validateRequest(getAllConstructionTypeSchema, REQUEST_SOURCE.QUERY),
  getAllConstructionTypes
);

router.delete(
  "/:construction_type_id",
  validateRequest(deleteConstructionTypeSchema, REQUEST_SOURCE.PARAMS),
  deleteConstructionType
);

router.put(
  "/:construction_type_id",
  validateRequest(updateConstructionTypeParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateConstructionTypeSchema, REQUEST_SOURCE.BODY),
  updateConstructionType
);

module.exports = router;
