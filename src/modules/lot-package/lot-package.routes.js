import express from "express";

const router = express.Router();

import {
  createLotPackageSchema,
  updateLotPackageSchema,
  getLotPackageByIdSchema,
  deleteLotPackageSchema,
  getAllLotPackagesSchema,
} from "./lot-package.validation";
import {
  createLotPackage,
  getAllLotPackages,
  getLotPackageById,
  updateLotPackage,
  deleteLotPackage,
} from "./lot-package.controller";
import { validateRequest } from "../../middleware/validateRequestMiddleware";
import authMiddleware from "../../middleware/authMiddleware";
import roleMiddleware from "../../middleware/roleMiddleware";
import camelToSnakeMiddleware from "../../middleware/caseConverterMiddleware";
import { REQUEST_SOURCE } from "../../config/constants";

router.use(authMiddleware);
router.use(roleMiddleware);
router.use(camelToSnakeMiddleware);

router.post(
  "/",
  validateRequest(createLotPackageSchema, REQUEST_SOURCE.BODY),
  createLotPackage,
);

router.get(
  "/",
  validateRequest(getAllLotPackagesSchema, REQUEST_SOURCE.QUERY),
  getAllLotPackages,
);

router.get(
  "/:lot_package_id",
  validateRequest(getLotPackageByIdSchema, REQUEST_SOURCE.PARAMS),
  getLotPackageById,
);

router.put(
  "/:lot_package_id",
  validateRequest(getLotPackageByIdSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateLotPackageSchema, REQUEST_SOURCE.BODY),
  updateLotPackage,
);

router.delete(
  "/:lot_package_id",
  validateRequest(deleteLotPackageSchema, REQUEST_SOURCE.PARAMS),
  deleteLotPackage,
);

export default router;
