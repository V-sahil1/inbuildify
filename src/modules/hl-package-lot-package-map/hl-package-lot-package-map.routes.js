const express = require("express");
const router = express.Router();

const {
  createHlPackageLotPackageMapSchema,
  getLotPackagesByHlPackageIdSchema,
  deleteHlPackageLotPackageMapSchema,
  getAllHlPackageLotPackageMapsSchema,
} = require("./hl-package-lot-package-map.validation");

const {
  createHlPackageLotPackageMap,
  getLotPackagesByHlPackageId,
  deleteHlPackageLotPackageMap,
  getAllHlPackageLotPackageMaps,
} = require("./hl-package-lot-package-map.controller");

const { validateRequest } = require("../../middleware/validateRequestMiddleware");
const authMiddleware = require("../../middleware/authMiddleware");
const roleMiddleware = require("../../middleware/roleMiddleware");
const camelToSnakeMiddleware = require("../../middleware/caseConverterMiddleware");
const { REQUEST_SOURCE } = require("../../config/constants");

router.use(authMiddleware);
router.use(roleMiddleware);
router.use(camelToSnakeMiddleware);

router.get(
  "/",
  validateRequest(getAllHlPackageLotPackageMapsSchema, REQUEST_SOURCE.QUERY),
  getAllHlPackageLotPackageMaps,
);

router.post(
  "/",
  validateRequest(createHlPackageLotPackageMapSchema, REQUEST_SOURCE.BODY),
  createHlPackageLotPackageMap,
);

router.get(
  "/:house_land_package_id",
  validateRequest(getLotPackagesByHlPackageIdSchema, REQUEST_SOURCE.PARAMS),
  getLotPackagesByHlPackageId,
);

router.delete(
  "/:id",
  validateRequest(deleteHlPackageLotPackageMapSchema, REQUEST_SOURCE.PARAMS),
  deleteHlPackageLotPackageMap,
);

module.exports = router;
