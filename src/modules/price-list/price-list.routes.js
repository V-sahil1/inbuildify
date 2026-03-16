import express from "express";

const router = express.Router();

import {
  createPriceList,
  getAllPriceList,
  deletePriceList,
  updatePriceList,
  toggleSuggestedPriceList,
} from "./price-list.controller.js";
import {
  createPriceListSchema,
  getAllPriceListSchema,
  deletePriceListSchema,
  updatePriceListParamsSchema,
  updatePriceListSchema,
} from "./price-list.validation.js";
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
  validateRequest(createPriceListSchema, REQUEST_SOURCE.BODY),
  createPriceList,
);

router.get(
  "/",
  validateRequest(getAllPriceListSchema, REQUEST_SOURCE.QUERY),
  getAllPriceList,
);

router.delete(
  "/:priceListId",
  validateRequest(deletePriceListSchema, REQUEST_SOURCE.PARAMS),
  deletePriceList,
);

router.put(
  "/:priceListId",
  validateRequest(updatePriceListParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updatePriceListSchema, REQUEST_SOURCE.BODY),
  updatePriceList,
);

router.put(
  "/suggested/:priceListId",
  validateRequest(deletePriceListSchema, REQUEST_SOURCE.PARAMS),
  toggleSuggestedPriceList,
);

export default router;
