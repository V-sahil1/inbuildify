import express from "express";

const router = express.Router();

import { createColorGroupItemMap, getAllColorGroupItemMaps, deleteColorGroupItemMap } from "./color-group-item-map.controller";
import {
  createColorGroupItemMapSchema,
  getAllColorGroupItemMapsSchema,
  deleteColorGroupItemMapSchema,
} from "./color-group-item-map.validation";
import { validateRequest } from "../../middleware/validateRequestMiddleware";
import authMiddleware from "../../middleware/authMiddleware";
import roleMiddleware from "../../middleware/roleMiddleware";
import caseConverterMiddleware from "../../middleware/caseConverterMiddleware";
import { REQUEST_SOURCE } from "../../config/constants";

router.use(authMiddleware);
router.use(roleMiddleware);
router.use(caseConverterMiddleware);

router.post(
  "/",
  validateRequest(createColorGroupItemMapSchema, REQUEST_SOURCE.BODY),
  createColorGroupItemMap,
);

router.get(
  "/",
  validateRequest(getAllColorGroupItemMapsSchema, REQUEST_SOURCE.QUERY),
  getAllColorGroupItemMaps,
);

router.delete(
  "/:id",
  validateRequest(deleteColorGroupItemMapSchema, REQUEST_SOURCE.PARAMS),
  deleteColorGroupItemMap,
);

export default router;
