import express from "express";

const router = express.Router();

import {
  createProperty,
  getPropertyByLeadId,
  updateProperty,
  getAllProperties,
  deleteProperty,
} from "./property.controller.js";
import { validateRequest } from "../../middleware/validateRequestMiddleware.js";
import {
  createPropertySchema,
  getPropertyByLeadSchema,
  updatePropertySchema,
  updatePropertyParamSchema,
  getAllPropertiesSchema,
  deletePropertySchema,
} from "./property.validation.js";
import authMiddleware from "../../middleware/authMiddleware.js";
import roleMiddleware from "../../middleware/roleMiddleware.js";
import camelToSnakeMiddleware from "../../middleware/caseConverterMiddleware.js";
import { REQUEST_SOURCE } from "../../config/constants.js";

router.use(authMiddleware);
router.use(roleMiddleware);
router.use(camelToSnakeMiddleware);

router.post("/", validateRequest(createPropertySchema), createProperty);
router.get("/", validateRequest(getAllPropertiesSchema, REQUEST_SOURCE.QUERY), getAllProperties);
router.get("/:lead_id", validateRequest(getPropertyByLeadSchema, REQUEST_SOURCE.PARAMS), getPropertyByLeadId);
router.put(
  "/:property_id",
  validateRequest(updatePropertyParamSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updatePropertySchema),
  updateProperty,
);
router.delete(
  "/:property_id",
  validateRequest(deletePropertySchema, REQUEST_SOURCE.PARAMS),
  deleteProperty,
);

export default router;
