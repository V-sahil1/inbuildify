import express from "express";

const router = express.Router();
import { createScreen, getScreens, deleteScreen, updateScreen } from "./screen.controller.js";
import { validateRequest } from "../../middleware/validateRequestMiddleware.js";
import authMiddleware from "../../middleware/authMiddleware.js";
import roleMiddleware from "../../middleware/roleMiddleware.js";
import camelToSnakeMiddleware from "../../middleware/caseConverterMiddleware.js";
import { REQUEST_SOURCE } from "../../config/constants.js";
import {
  createScreenSchema,
  deleteScreenSchema,
  updateScreenParamsSchema,
  updateScreenSchema,
} from "./screen.validation.js";

router.use(authMiddleware);
router.use(roleMiddleware);
router.use(camelToSnakeMiddleware);

router.post(
  "/",
  validateRequest(createScreenSchema, REQUEST_SOURCE.BODY),
  createScreen,
);

router.get("/", getScreens);

router.delete(
  "/:screen_id",
  validateRequest(deleteScreenSchema, REQUEST_SOURCE.PARAMS),
  deleteScreen,
);

router.put(
  "/:screen_id",
  validateRequest(updateScreenParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateScreenSchema, REQUEST_SOURCE.BODY),
  updateScreen,
);

export default router;
