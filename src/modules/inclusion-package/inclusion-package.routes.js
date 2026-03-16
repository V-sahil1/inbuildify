import express from "express";

const router = express.Router();

import {
  createInclusionPackage,
  getAllInclusionPackages,
  getInclusionPackageById,
  updateInclusionPackage,
  deleteInclusionPackage,
} from "./inclusion-package.controller";
import { validateRequest } from "../../middleware/validateRequestMiddleware";
import {
  createInclusionPackageSchema,
  updateInclusionPackageSchema,
  inclusionPackageIdSchema,
} from "./inclusion-package.validation";
import authMiddleware from "../../middleware/authMiddleware";
import roleMiddleware from "../../middleware/roleMiddleware";
import camelToSnakeMiddleware from "../../middleware/caseConverterMiddleware";
import { REQUEST_SOURCE } from "../../config/constants";

router.use(authMiddleware);
router.use(roleMiddleware);
router.use(camelToSnakeMiddleware);

router.post("/", validateRequest(createInclusionPackageSchema), createInclusionPackage);
router.get("/", getAllInclusionPackages);
router.get(
  "/:id",
  validateRequest(inclusionPackageIdSchema, REQUEST_SOURCE.PARAMS),
  getInclusionPackageById,
);
router.put(
  "/:id",
  validateRequest(inclusionPackageIdSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateInclusionPackageSchema, REQUEST_SOURCE.BODY),
  updateInclusionPackage,
);
router.delete(
  "/:id",
  validateRequest(inclusionPackageIdSchema, REQUEST_SOURCE.PARAMS),
  deleteInclusionPackage,
);

export default router;
