const express = require("express");
const router = express.Router();
const {
  createPackage,
  getPackageById,
  getAllPackages,
  getPackageItems,
  updatePackage,
  deletePackage,
} = require("../controllers/packages.controller");
const { validateRequest } = require("../middleware/validateRequestMiddleware");
const {
  createPackageSchema,
  getPackageByIdSchema,
  getAllPackagesSchema,
  updatePackageSchema,
  deletePackageSchema,
} = require("../validations/packages.validation");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const { REQUEST_SOURCE } = require("../config/constants");

router.use(authMiddleware);
router.use(roleMiddleware);

router.post("/", validateRequest(createPackageSchema), createPackage);
router.post("/:package_id", validateRequest(updatePackageSchema), updatePackage);
router.get("/:package_id", validateRequest(getPackageByIdSchema, REQUEST_SOURCE.PARAMS), getPackageById);
router.get("/", validateRequest(getAllPackagesSchema, REQUEST_SOURCE.QUERY), getAllPackages);
router.get("/category/items", validateRequest(getAllPackagesSchema, REQUEST_SOURCE.QUERY), getPackageItems);
router.delete("/:package_id", validateRequest(deletePackageSchema, REQUEST_SOURCE.PARAMS), deletePackage);

module.exports = router;
