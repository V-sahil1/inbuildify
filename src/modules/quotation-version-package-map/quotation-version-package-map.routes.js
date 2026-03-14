const express = require("express");
const router = express.Router();

const authMiddleware = require("../../middleware/authMiddleware.js");
const roleMiddleware = require("../../middleware/roleMiddleware.js");
const camelToSnakeMiddleware = require("../../middleware/caseConverterMiddleware.js");

const { validateRequest } = require("../../middleware/validateRequestMiddleware.js");
const { REQUEST_SOURCE } = require("../../config/constants.js");
const {
  createPackageMapSchema,
  getPackageMapsByVersionSchema,
  deletePackageMapParamsSchema,
} = require("./quotation-version-package-map.validation.js");
const packageMapController = require("./quotation-version-package-map.controller.js");

router.use(authMiddleware);
router.use(roleMiddleware);

router.post(
  "/",
  camelToSnakeMiddleware,
  validateRequest(createPackageMapSchema, REQUEST_SOURCE.BODY),
  packageMapController.createPackageMap
);

router.get(
  "/:quotation_version_id",
  validateRequest(getPackageMapsByVersionSchema, REQUEST_SOURCE.PARAMS),
  packageMapController.getPackagesByVersionId
);

router.delete(
  "/:id",
  validateRequest(deletePackageMapParamsSchema, REQUEST_SOURCE.PARAMS),
  packageMapController.deletePackageMap
);

module.exports = router;
