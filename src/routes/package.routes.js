const express = require("express");
const router = express.Router();
const {
  createPackage,
  getPackageById,
  getAllPackages,
  getPackageItems,
} = require("../controllers/packages.controller");
const { validateRequest } = require("../middleware/validateRequestMiddleware");
const {
  createPackageSchema,
  getPackageByIdSchema,
  getPackageItemsSchema,
} = require("../validations/packages.validation");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const { REQUEST_SOURCE } = require("../config/constants");

router.use(authMiddleware);
router.use(roleMiddleware);

router.post("/", validateRequest(createPackageSchema), createPackage);
router.get("/:package_id", validateRequest(getPackageByIdSchema, REQUEST_SOURCE.PARAMS), getPackageById);
router.get("/", getAllPackages);
router.get("/category/items", validateRequest(getPackageItemsSchema, REQUEST_SOURCE.QUERY), getPackageItems);

module.exports = router;
