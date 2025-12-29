const express = require("express");
const router = express.Router();

const {
  createConstructionType,
  getAllConstructionTypes,
  deleteConstructionType,
  updateConstructionType,
} = require("../controllers/construction-type.controller");
const {
  createConstructiontyeSchema,
  getAllConstructionTypeSchema,
  deleteConstructionTypeSchema,
  updateConstructionTypeParamsSchema,
  updateConstructionTypeSchema,
} = require("../validations/construction-type.validation");

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
