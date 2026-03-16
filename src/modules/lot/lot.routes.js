import express from "express";

const router = express.Router();
import { createLot, getAllLots, getLotById, updateLot, deleteLot } from "./lot.controller";
import {
  createLotSchema,
  updateLotSchema,
  getLotByIdSchema,
  deleteLotSchema,
  getAllLotsSchema,
} from "./lot.validation";
import { validateRequest } from "../../middleware/validateRequestMiddleware";
import authMiddleware from "../../middleware/authMiddleware";
import { REQUEST_SOURCE } from "../../config/constants";
import roleMiddleware from "../../middleware/roleMiddleware";
import camelToSnakeMiddleware from "../../middleware/caseConverterMiddleware";

router.use(authMiddleware);
router.use(roleMiddleware);
router.use(camelToSnakeMiddleware);

router.post(
  "/",
  validateRequest(createLotSchema, REQUEST_SOURCE.BODY),
  createLot,
);

router.get(
  "/",
  validateRequest(getAllLotsSchema, REQUEST_SOURCE.QUERY),
  getAllLots,
);

router.get(
  "/:lot_id",
  validateRequest(getLotByIdSchema, REQUEST_SOURCE.PARAMS),
  getLotById,
);

router.put(
  "/:lot_id",
  validateRequest(getLotByIdSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateLotSchema, REQUEST_SOURCE.BODY),
  updateLot,
);

router.delete(
  "/:lot_id",
  validateRequest(deleteLotSchema, REQUEST_SOURCE.PARAMS),
  deleteLot,
);

export default router;
