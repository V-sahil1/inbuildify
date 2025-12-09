const express = require("express");
const router = express.Router();

const {
  createPackageLabelMap,
  getAllPackageLabelMap,
  getPackageLabelMapByPackageId,
  deletePackageLabelMap,
  updatePackageLabelMap,
} = require("../controllers/package-label-map.controller");
const {
  createPackageLabelMapSchema,
  getAllPackageLabelSchema,
  getPackageLabelMapByPackageIdSchema,
  deletePackageLabelMapSchema,
  udatePackageLabelMapParamsSchema,
  updatePackageLabelMapSchema,
} = require("../validations/package-label-map.validation");

const { validateRequest } = require("../middleware/validateRequestMiddleware");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

const { REQUEST_SOURCE } = require("../config/constants");

router.use(authMiddleware);
router.use(roleMiddleware);

router.post(
  "/",
  validateRequest(createPackageLabelMapSchema, REQUEST_SOURCE.BODY),
  createPackageLabelMap
);

router.get(
  "/",
  validateRequest(getAllPackageLabelSchema, REQUEST_SOURCE.QUERY),
  getAllPackageLabelMap
);

router.get(
  "/:package_id",
  validateRequest(getPackageLabelMapByPackageIdSchema, REQUEST_SOURCE.PARAMS),
  getPackageLabelMapByPackageId
);

router.delete(
  "/:id",
  validateRequest(deletePackageLabelMapSchema, REQUEST_SOURCE.PARAMS),
  deletePackageLabelMap
);

router.put(
  "/:id",
  validateRequest(udatePackageLabelMapParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updatePackageLabelMapSchema, REQUEST_SOURCE.BODY),
  updatePackageLabelMap
);

module.exports = router;
