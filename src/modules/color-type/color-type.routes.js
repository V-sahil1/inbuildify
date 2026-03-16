import express from "express";

const router = express.Router();

import {
  createColorType,
  getAllColorTypes,
  getColorTypeById,
  updateColorType,
  deleteColorType,
} from "./color-type.controller";
import authMiddleware from "../../middleware/authMiddleware";
import roleMiddleware from "../../middleware/roleMiddleware";
import camelToSnakeMiddleware from "../../middleware/caseConverterMiddleware";
import { validateRequest } from "../../middleware/validateRequestMiddleware";
import { REQUEST_SOURCE } from "../../config/constants";
import { createColorTypeSchema, updateColorTypeSchema, paramsIdSchema } from "./color-type.validation";

router.use(authMiddleware);
router.use(roleMiddleware);

router.post(
  "/",
  camelToSnakeMiddleware,
  validateRequest(createColorTypeSchema, REQUEST_SOURCE.BODY),
  createColorType,
);

router.get("/", getAllColorTypes);

router.get("/:id", getColorTypeById);

router.put(
  "/:id",
  camelToSnakeMiddleware,
  validateRequest(paramsIdSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateColorTypeSchema, REQUEST_SOURCE.BODY),
  updateColorType,
);

router.delete("/:id", deleteColorType);

export default router;
