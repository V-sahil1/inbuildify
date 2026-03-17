import express from "express";

const router = express.Router();

import { createRecalculateDate, getRecalculateDate, updateRecalculateDate } from "./recalculate-date..controller.js";
import { createRecalculateDateSchema, updateRecalculateDateSchema } from "./recalculate-date.validation.js";
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
  validateRequest(createRecalculateDateSchema, REQUEST_SOURCE.BODY),
  createRecalculateDate,
);

router.get("/", getRecalculateDate);

router.put(
  "/",
  validateRequest(updateRecalculateDateSchema, REQUEST_SOURCE.BODY),
  updateRecalculateDate,
);

export default router;
