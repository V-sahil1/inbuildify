const express = require("express");
const router = express.Router();
const {
  createPackage,
  getAllPackages,
  updatePackage,
  deletePackage,
} = require("../controllers/package.controller");
const { validateRequest } = require("../middleware/validateRequestMiddleware");
const {
  createPackageSchema,
  getAllPackagesSchema,
  updatePackageParamsSchema,
  updatePackageSchema,
  deletePackageSchema,
} = require("../validations/package.validation");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const { REQUEST_SOURCE } = require("../config/constants");

router.use(authMiddleware);
router.use(roleMiddleware);

router.post("/", validateRequest(createPackageSchema), createPackage);
router.post(
  "/:package_id",
  validateRequest(updatePackageSchema),
  updatePackage
);

router.get(
  "/",
  validateRequest(getAllPackagesSchema, REQUEST_SOURCE.QUERY),
  getAllPackages
);

router.delete(
  "/:package_id",
  validateRequest(deletePackageSchema, REQUEST_SOURCE.PARAMS),
  deletePackage
);

router.put(
  "/:package_id",
  validateRequest(updatePackageParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updatePackageSchema, REQUEST_SOURCE.BODY),
  updatePackage
);
module.exports = router;
