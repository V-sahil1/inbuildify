const express = require("express");
const router = express.Router();

const {
  createPackageDwellingMap,
  getAllPackageDwellingMap,
  getPackageDwellingMapByPackageId,
  deletePackageDwellingMap,
  updatePackageDwellingMap,
} = require("../controllers/package-dwelling-map.controller");
const {
  createPackageDwellingMaoSchema,
  getAllPackageDwellingMapSchema,
  getPackageDwellingMapByPackageIdSchema,
  deletePackageDwellingMapSchema,
  updatePackageDwellingMapByPackageParamsSchema,
  updatePackageDwellingMapSchema,
} = require("../validations/package-dwelling-map.validation");

const { validateRequest } = require("../middleware/validateRequestMiddleware");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const camelToSnakeMiddleware = require("../middleware/caseConverterMiddleware.js");

const { REQUEST_SOURCE } = require("../config/constants");

router.use(authMiddleware);
router.use(roleMiddleware);
router.use(camelToSnakeMiddleware);

router.post(
  "/",
  validateRequest(createPackageDwellingMaoSchema, REQUEST_SOURCE.BODY),
  createPackageDwellingMap
);

router.get(
  "/",
  validateRequest(getAllPackageDwellingMapSchema, REQUEST_SOURCE.QUERY),
  getAllPackageDwellingMap
);

router.get(
  "/:package_id",
  validateRequest(
    getPackageDwellingMapByPackageIdSchema,
    REQUEST_SOURCE.PARAMS
  ),
  getPackageDwellingMapByPackageId
);

router.delete(
  "/:id",
  validateRequest(deletePackageDwellingMapSchema, REQUEST_SOURCE.PARAMS),
  deletePackageDwellingMap
);

router.put(
  "/:id",
  validateRequest(
    updatePackageDwellingMapByPackageParamsSchema,
    REQUEST_SOURCE.PARAMS
  ),
  validateRequest(updatePackageDwellingMapSchema, REQUEST_SOURCE.BODY),
  updatePackageDwellingMap
);

module.exports = router;
