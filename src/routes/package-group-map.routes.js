const express = require("express");
const router = express.Router();

const {
  createPackageGroupMap,
  getAllPackageGroupMaps,
  getPackageGroupMapByPackageId,
  deletePackageGroupMap,
  updatePackageGroupMap,
} = require("../controllers/package-group-map.controller");
const {
  createPackageGroupMapSchema,
  getAllPackageGroupmaoSchema,
  getPackageGroupMapByPackageIdSchema,
  deletePackageGroupMapSchema,
  updatePackageGroupMapParamsSchema,
  updatePackageGroupMapSchema,
} = require("../validations/package-group-map.validation");

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
  validateRequest(createPackageGroupMapSchema, REQUEST_SOURCE.BODY),
  createPackageGroupMap
);

router.get(
  "/",
  validateRequest(getAllPackageGroupmaoSchema, REQUEST_SOURCE.QUERY),
  getAllPackageGroupMaps
);

router.get(
  "/:package_id",
  validateRequest(getPackageGroupMapByPackageIdSchema, REQUEST_SOURCE.PARAMS),
  getPackageGroupMapByPackageId
);

router.delete(
  "/:id",
  validateRequest(deletePackageGroupMapSchema, REQUEST_SOURCE.PARAMS),
  deletePackageGroupMap
);

router.put(
  "/:id",
  validateRequest(updatePackageGroupMapParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updatePackageGroupMapSchema, REQUEST_SOURCE.BODY),
  updatePackageGroupMap
);

module.exports = router;
