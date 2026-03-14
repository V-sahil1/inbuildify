const express = require("express");
const router = express.Router();
const {
  createInclusionPackage,
  getAllInclusionPackages,
  getInclusionPackageById,
  updateInclusionPackage,
  deleteInclusionPackage,
} = require("./inclusion-package.controller");
const { validateRequest } = require("../../middleware/validateRequestMiddleware");
const {
  createInclusionPackageSchema,
  updateInclusionPackageSchema,
  inclusionPackageIdSchema,
} = require("./inclusion-package.validation");
const authMiddleware = require("../../middleware/authMiddleware");
const roleMiddleware = require("../../middleware/roleMiddleware");
const camelToSnakeMiddleware = require("../../middleware/caseConverterMiddleware");

const { REQUEST_SOURCE } = require("../../config/constants");

router.use(authMiddleware);
router.use(roleMiddleware);
router.use(camelToSnakeMiddleware);

router.post("/", validateRequest(createInclusionPackageSchema), createInclusionPackage);
router.get("/", getAllInclusionPackages);
router.get(
  "/:id",
  validateRequest(inclusionPackageIdSchema, REQUEST_SOURCE.PARAMS),
  getInclusionPackageById
);
router.put(
  "/:id",
  validateRequest(inclusionPackageIdSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateInclusionPackageSchema, REQUEST_SOURCE.BODY),
  updateInclusionPackage
);
router.delete(
  "/:id",
  validateRequest(inclusionPackageIdSchema, REQUEST_SOURCE.PARAMS),
  deleteInclusionPackage
);

module.exports = router;
