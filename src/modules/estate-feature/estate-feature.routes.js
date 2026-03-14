const express = require("express");
const router = express.Router();

const {
  createEstateFeature,
  getAllEstateFeatures,
  getEstateFeaturesByEstateId,
  updateEstateFeature,
  deleteEstateFeature,
} = require("./estate-feature.controller.js");
const {
  createEstateFeatureSchema,
  getAllEstateFeatureSchema,
  getEstateFeatureByEstateIdSchema,
  updateEstateFeatureSchema,
  updateEstateFeatureParamsSchema,
  deleteEstateFeatureSchema,
} = require("./estate-feature.validation.js");

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

router.put(
  "/:estate_feature_id",
  validateRequest(updateEstateFeatureParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateEstateFeatureSchema, REQUEST_SOURCE.BODY),
  updateEstateFeature
);

router.delete(
  "/:estate_feature_id",
  validateRequest(deleteEstateFeatureSchema, REQUEST_SOURCE.PARAMS),
  deleteEstateFeature
);

module.exports = router;
