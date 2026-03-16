import express from "express";

const router = express.Router();

import {
  createColorItemCustomField,
  getColorItemCustomFields,
  getColorItemCustomFieldById,
  updateColorItemCustomField,
  deleteColorItemCustomField,
} from "./color-item-custom-field.controller";
import authMiddleware from "../../middleware/authMiddleware";
import roleMiddleware from "../../middleware/roleMiddleware";
import camelToSnakeMiddleware from "../../middleware/caseConverterMiddleware";
import { validateRequest } from "../../middleware/validateRequestMiddleware";
import { REQUEST_SOURCE } from "../../config/constants";
import { createColorItemCustomFieldSchema, updateColorItemCustomFieldSchema } from "./color-item-custom-field.validation";

router.use(authMiddleware);
router.use(roleMiddleware);

router.post(
  "/",
  camelToSnakeMiddleware,
  validateRequest(createColorItemCustomFieldSchema, REQUEST_SOURCE.BODY),
  createColorItemCustomField,
);

router.get("/", getColorItemCustomFields);

router.get("/:id", getColorItemCustomFieldById);

router.put(
  "/:id",
  camelToSnakeMiddleware,
  validateRequest(updateColorItemCustomFieldSchema, REQUEST_SOURCE.BODY),
  updateColorItemCustomField,
);

router.delete("/:id", deleteColorItemCustomField);

export default router;
