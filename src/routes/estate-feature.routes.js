const express = require("express");
const router = express.Router();

const {
  createEstateFeature,
  getAllEstateFeatures,
  getEstateFeaturesByEstateId,
  deleteEstateFeature,
} = require("../controllers/estate-feature.controller");
const {
  createEstateFeatureSchema,
  getAllEstateFeatureSchema,
  getEstateFeatureByEstateIdSchema,
  deleteEstateFeatureSchema,
} = require("../validations/estate-feature.validation");

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
  validateRequest(createEstateFeatureSchema, REQUEST_SOURCE.BODY),
  createEstateFeature
);

router.get(
  "/",
  validateRequest(getAllEstateFeatureSchema, REQUEST_SOURCE.QUERY),
  getAllEstateFeatures
);

router.get(
  "/:estate_id",
  validateRequest(getEstateFeatureByEstateIdSchema, REQUEST_SOURCE.PARAMS),
  getEstateFeaturesByEstateId
);

router.delete(
  "/:estate_feature_id",
  validateRequest(deleteEstateFeatureSchema, REQUEST_SOURCE.PARAMS),
  deleteEstateFeature
);

module.exports = router;
