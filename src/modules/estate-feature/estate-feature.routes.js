import express from "express";

const router = express.Router();

import {
  createEstateFeature,
  getAllEstateFeatures,
  getEstateFeaturesByEstateId,
  updateEstateFeature,
  deleteEstateFeature,
} from "./estate-feature.controller.js";
import {
  createEstateFeatureSchema,
  getAllEstateFeatureSchema,
  getEstateFeatureByEstateIdSchema,
  updateEstateFeatureSchema,
  updateEstateFeatureParamsSchema,
  deleteEstateFeatureSchema,
} from "./estate-feature.validation.js";
import { validateRequest } from "../../middleware/validateRequestMiddleware.js";
import authMiddleware from "../../middleware/authMiddleware.js";
import roleMiddleware from "../../middleware/roleMiddleware.js";
import camelToSnakeMiddleware from "../../middleware/caseConverterMiddleware.js";
import { REQUEST_SOURCE } from "../../config/constants.js";

router.use(authMiddleware);
router.use(roleMiddleware);
router.use(camelToSnakeMiddleware);

router.post(
  "/",
  validateRequest(createEstateFeatureSchema, REQUEST_SOURCE.BODY),
  createEstateFeature,
);

router.get(
  "/",
  validateRequest(getAllEstateFeatureSchema, REQUEST_SOURCE.QUERY),
  getAllEstateFeatures,
);

router.get(
  "/:estate_id",
  validateRequest(getEstateFeatureByEstateIdSchema, REQUEST_SOURCE.PARAMS),
  getEstateFeaturesByEstateId,
);

router.put(
  "/:estate_feature_id",
  validateRequest(updateEstateFeatureParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateEstateFeatureSchema, REQUEST_SOURCE.BODY),
  updateEstateFeature,
);

router.delete(
  "/:estate_feature_id",
  validateRequest(deleteEstateFeatureSchema, REQUEST_SOURCE.PARAMS),
  deleteEstateFeature,
);

export default router;
