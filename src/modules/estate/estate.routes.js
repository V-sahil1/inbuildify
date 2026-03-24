import express from "express";

const router = express.Router();

import { createEstate, getAllEstate, deleteEstate, updateEstate } from "./estate.controller.js";
import {
  createEstateSchema,
  getAllEstateSchema,
  deleteEstateSchema,
  updateEstateParamsSchema,
  updateEstateSchema,
} from "./estate.validation.js";
import { validateRequest } from "../../middleware/validateRequestMiddleware.js";
import authMiddleware from "../../middleware/authMiddleware.js";
import roleMiddleware from "../../middleware/roleMiddleware.js";
import camelToSnakeMiddleware from "../../middleware/caseConverterMiddleware.js";
import { createUpload, handleMulterError } from "../../utils/s3Upload.js";
import { REQUEST_SOURCE } from "../../config/constants.js";

router.use(authMiddleware);
router.use(roleMiddleware);

const upload = createUpload("estate");

router.post(
  "/",
  upload.single("estateLogo"),
  handleMulterError,
  camelToSnakeMiddleware,
  validateRequest(createEstateSchema, REQUEST_SOURCE.FORM_DATA),
  createEstate,
);

router.get(
  "/",
  camelToSnakeMiddleware,
  validateRequest(getAllEstateSchema, REQUEST_SOURCE.QUERY),
  getAllEstate,
);

router.delete(
  "/:estate_id",
  camelToSnakeMiddleware,
  validateRequest(deleteEstateSchema, REQUEST_SOURCE.PARAMS),
  deleteEstate,
);

router.put(
  "/:estate_id",
  upload.single("estateLogo"),
  handleMulterError,
  camelToSnakeMiddleware,
  validateRequest(updateEstateParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateEstateSchema, REQUEST_SOURCE.BODY),
  updateEstate,
);

export default router;
