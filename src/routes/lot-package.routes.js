const express = require("express");
const router = express.Router();

const {
  createLotPackageSchema,
  updateLotPackageSchema,
  getLotPackageByIdSchema,
  deleteLotPackageSchema,
  getAllLotPackagesSchema,
} = require("../validations/lot-package.validation");

const {
  createLotPackage,
  getAllLotPackages,
  getLotPackageById,
  updateLotPackage,
  deleteLotPackage,
} = require("../controllers/lot-package.controller");

const { validateRequest } = require("../middleware/validateRequestMiddleware");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const camelToSnakeMiddleware = require("../middleware/caseConverterMiddleware");
const { REQUEST_SOURCE } = require("../config/constants");

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

module.exports = router;
