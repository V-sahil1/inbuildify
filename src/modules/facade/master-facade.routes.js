import express from "express";

const router = express.Router();

import {
  createMasterFacade,
  getMasterFacades,
  getMasterFacadeById,
  updateMasterFacade,
  deleteMasterFacade,
} from "./master-facade.controller.js";
import authMiddleware from "../../middleware/authMiddleware.js";
import roleMiddleware from "../../middleware/roleMiddleware.js";
import camelToSnakeMiddleware from "../../middleware/caseConverterMiddleware.js";
import { validateRequest } from "../../middleware/validateRequestMiddleware.js";
import { createUpload, handleMulterError } from "../../utils/s3Upload.js";
import {
  createMasterFacadeSchema,
  getMasterFacadeByIdSchema,
  getMasterFacadesSchema,
  updateMasterFacadeParamsSchema,
  updateMasterFacadeSchema,
  deleteMasterFacadeSchema,
} from "./master-facade.validation.js";
import { REQUEST_SOURCE } from "../../config/constants.js";

router.use(authMiddleware);
router.use(roleMiddleware);

const upload = createUpload("facade");

router.post(
  "/",
  upload.single("image"),
  handleMulterError,
  camelToSnakeMiddleware,
  validateRequest(createMasterFacadeSchema, REQUEST_SOURCE.FORM_DATA),
  createMasterFacade,
);

router.get(
  "/",
  camelToSnakeMiddleware,
  validateRequest(getMasterFacadesSchema, REQUEST_SOURCE.QUERY),
  getMasterFacades,
);

router.get(
  "/:id",
  camelToSnakeMiddleware,
  validateRequest(getMasterFacadeByIdSchema, REQUEST_SOURCE.PARAMS),
  getMasterFacadeById,
);

router.put(
  "/:facade_id",
  upload.single("image"),
  handleMulterError,
  camelToSnakeMiddleware,
  validateRequest(updateMasterFacadeParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateMasterFacadeSchema, REQUEST_SOURCE.FORM_DATA),
  updateMasterFacade,
);

router.delete(
  "/:facade_id",
  camelToSnakeMiddleware,
  validateRequest(deleteMasterFacadeSchema, REQUEST_SOURCE.PARAMS),
  deleteMasterFacade,
);

export default router;
