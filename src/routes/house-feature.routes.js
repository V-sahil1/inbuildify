const express = require("express");
const router = express.Router();
const {
  createHouseFeature,
  getAllHouseFeatures,
  getHouseFeatureById,
  updateHouseFeature,
  deleteHouseFeature,
} = require("../controllers/house-feature.controller");
const {
  createHouseFeatureSchema,
  updateHouseFeatureSchema,
  getHouseFeatureByIdSchema,
  deleteHouseFeatureSchema,
  getAllHouseFeaturesSchema,
} = require("../validations/house-feature.validation");
const { validateRequest } = require("../middleware/validateRequestMiddleware");
const authMiddleware = require("../middleware/authMiddleware");
const { REQUEST_SOURCE } = require("../config/constants");
const roleMiddleware = require("../middleware/roleMiddleware");
const camelToSnakeMiddleware = require("../middleware/caseConverterMiddleware");

router.post(
  "/",
  authMiddleware,
  roleMiddleware,
  camelToSnakeMiddleware,
  validateRequest(createHouseFeatureSchema, REQUEST_SOURCE.BODY),
  createHouseFeature,
);

router.get(
  "/",
  authMiddleware,
  roleMiddleware,
  validateRequest(getAllHouseFeaturesSchema, REQUEST_SOURCE.QUERY),
  getAllHouseFeatures,
);

router.get(
  "/:house_feature_id",
  authMiddleware,
  roleMiddleware,
  validateRequest(getHouseFeatureByIdSchema, REQUEST_SOURCE.PARAMS),
  getHouseFeatureById,
);

router.put(
  "/:house_feature_id",
  authMiddleware,
  roleMiddleware,
  camelToSnakeMiddleware,
  validateRequest(getHouseFeatureByIdSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateHouseFeatureSchema, REQUEST_SOURCE.BODY),
  updateHouseFeature,
);

router.delete(
  "/:house_feature_id",
  authMiddleware,
  roleMiddleware,
  validateRequest(deleteHouseFeatureSchema, REQUEST_SOURCE.PARAMS),
  deleteHouseFeature,
);

module.exports = router;
