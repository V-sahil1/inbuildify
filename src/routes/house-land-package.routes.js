const express = require("express");
const router = express.Router();

const {
  createHouseLandPackage,
  getAllHouseLandPackages,
  getHouseLandPackageById,
  updateHouseLandPackage,
  deleteHouseLandPackage,
} = require("../controllers/house-land-package.controller");

const {
  createHouseLandPackageSchema,
  updateHouseLandPackageSchema,
  getHouseLandPackageByIdSchema,
  deleteHouseLandPackageSchema,
  getAllHouseLandPackagesSchema,
} = require("../validations/house-land-package.validation");

const { authMiddleware } = require("../middleware/auth");
const { roleMiddleware } = require("../middleware/role");
const { camelToSnakeMiddleware } = require("../middleware/camelToSnake");
const { validateRequest } = require("../middleware/validateRequest");
const { REQUEST_SOURCE } = require("../constants");

router.use(authMiddleware);
router.use(roleMiddleware);
router.use(camelToSnakeMiddleware);

router.post(
  "/",
  validateRequest(createHouseLandPackageSchema, REQUEST_SOURCE.BODY),
  createHouseLandPackage,
);

router.get(
  "/",
  validateRequest(getAllHouseLandPackagesSchema, REQUEST_SOURCE.QUERY),
  getAllHouseLandPackages,
);

router.get(
  "/:house_land_package_id",
  validateRequest(getHouseLandPackageByIdSchema, REQUEST_SOURCE.PARAMS),
  getHouseLandPackageById,
);

router.put(
  "/:house_land_package_id",
  validateRequest(getHouseLandPackageByIdSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateHouseLandPackageSchema, REQUEST_SOURCE.BODY),
  updateHouseLandPackage,
);

router.delete(
  "/:house_land_package_id",
  validateRequest(deleteHouseLandPackageSchema, REQUEST_SOURCE.PARAMS),
  deleteHouseLandPackage,
);

module.exports = router;