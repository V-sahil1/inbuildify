import express from "express";

const router = express.Router();

import authMiddleware from "../../middleware/authMiddleware.js";
import roleMiddleware from "../../middleware/roleMiddleware.js";
import camelToSnakeMiddleware from "../../middleware/caseConverterMiddleware.js";
import { validateRequest } from "../../middleware/validateRequestMiddleware.js";
import { REQUEST_SOURCE } from "../../config/constants.js";
import {
  createPricelistItemMapSchema,
  getByVersionParamsSchema,
  updatePricelistItemMapSchema,
  idParamsSchema,
} from "./quotation-version-pricelist-item-map.validation.js";
import controller from "./quotation-version-pricelist-item-map.controller.js";

router.use(authMiddleware);
router.use(roleMiddleware);

router.post(
  "/",
  camelToSnakeMiddleware,
  validateRequest(createPricelistItemMapSchema, REQUEST_SOURCE.BODY),
  controller.createPricelistItemMap,
);

router.get(
  "/:quotation_version_id",
  validateRequest(getByVersionParamsSchema, REQUEST_SOURCE.PARAMS),
  controller.getPricelistItemsByVersionId,
);

router.put(
  "/:id",
  camelToSnakeMiddleware,
  validateRequest(idParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updatePricelistItemMapSchema, REQUEST_SOURCE.BODY),
  controller.updatePricelistItemMap,
);

router.delete(
  "/:id",
  validateRequest(idParamsSchema, REQUEST_SOURCE.PARAMS),
  controller.deletePricelistItemMap,
);

export default router;
