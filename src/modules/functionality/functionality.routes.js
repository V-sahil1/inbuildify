import express from "express";

const router = express.Router();

import {
  createFunctionality,
  getFunctionalities,
  deleteFunctionality,
  updateFunctionality,
  getFunctionalitiesByScreen,
} from "./functionality.controller.js";
import {
  createFunctionalitySchema,
  getFunctionalitiesSchema,
  deleteFunctionalitySchema,
  updateFunctionalityParamsSchema,
  updateFunctionalitySchema,
  getFunctionalitiesByScreenSchema,
} from "./functionality.validation.js";
import authMiddleware from "../../middleware/authMiddleware.js";
import roleMiddleware from "../../middleware/roleMiddleware.js";
import camelToSnakeMiddleware from "../../middleware/caseConverterMiddleware.js";
import { validateRequest } from "../../middleware/validateRequestMiddleware.js";
import { REQUEST_SOURCE } from "../../config/constants.js";

router.use(authMiddleware);
router.use(roleMiddleware);
router.use(camelToSnakeMiddleware);

router.post(
  "/",
  validateRequest(createFunctionalitySchema, REQUEST_SOURCE.BODY),
  createFunctionality,
);

router.get("/", getFunctionalities);

router.get(
  "/:screenId",
  validateRequest(getFunctionalitiesByScreenSchema, REQUEST_SOURCE.PARAMS),
  getFunctionalitiesByScreen,
);

router.delete(
  "/:functionality_id",
  validateRequest(deleteFunctionalitySchema, REQUEST_SOURCE.PARAMS),
  deleteFunctionality,
);

router.put(
  "/:functionality_id",
  validateRequest(updateFunctionalityParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateFunctionalitySchema, REQUEST_SOURCE.BODY),
  updateFunctionality,
);

export default router;
