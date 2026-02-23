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

const { validateRequest } = require("../middleware/validateRequestMiddleware");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const camelToSnakeMiddleware = require("../middleware/caseConverterMiddleware.js");
const { REQUEST_SOURCE } = require("../config/constants");
const { createImageOrPdfUpload, handleMulterError } = require("../utils/s3Upload");

router.use(authMiddleware);
router.use(roleMiddleware);
router.use(camelToSnakeMiddleware);

// File upload middleware for house land package attachments
const upload = createImageOrPdfUpload("house-land-package-attachments");

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
  upload.fields([
    { name: "attachFiles", maxCount: 10 },
  ]),
  handleMulterError,
  camelToSnakeMiddleware,
  validateRequest(getHouseLandPackageByIdSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateHouseLandPackageSchema, REQUEST_SOURCE.FORM_DATA),
  updateHouseLandPackage,
);

router.delete(
  "/:house_land_package_id",
  validateRequest(deleteHouseLandPackageSchema, REQUEST_SOURCE.PARAMS),
  deleteHouseLandPackage,
);

module.exports = router;