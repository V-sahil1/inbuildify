import express from "express";

const router = express.Router();

import { createColor, getColors, getColorById, updateColor, deleteColor, copyColor } from "./color.controller.js";
import authMiddleware from "../../middleware/authMiddleware.js";
import roleMiddleware from "../../middleware/roleMiddleware.js";
import camelToSnakeMiddleware from "../../middleware/caseConverterMiddleware.js";
import { validateRequest } from "../../middleware/validateRequestMiddleware.js";
import { REQUEST_SOURCE } from "../../config/constants.js";
import { createColorSchema, updateColorSchema, copyColorSchema } from "./color.validation.js";

router.use(authMiddleware);
router.use(roleMiddleware);

router.post(
  "/",
  camelToSnakeMiddleware,
  validateRequest(createColorSchema, REQUEST_SOURCE.BODY),
  createColor,
);

router.get("/", getColors);

router.get("/:id", getColorById);

router.put(
  "/:id",
  camelToSnakeMiddleware,
  validateRequest(updateColorSchema, REQUEST_SOURCE.BODY),
  updateColor,
);

router.delete("/:id", deleteColor);

router.post(
  "/copy/:color_id",
  camelToSnakeMiddleware,
  validateRequest(copyColorSchema, REQUEST_SOURCE.BODY),
  copyColor,
);

export default router;
