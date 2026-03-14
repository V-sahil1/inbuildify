const express = require("express");
const router = express.Router();

const {
  createHouseLandPackage,
  getAllHouseLandPackages,
  getHouseLandPackageById,
  updateHouseLandPackage,
  deleteHouseLandPackage,
  getHouseLandPackageDetailedInfo,
} = require("./house-land-package.controller.js");

const {
  createHouseLandPackageSchema,
  updateHouseLandPackageSchema,
  getHouseLandPackageByIdSchema,
  deleteHouseLandPackageSchema,
  getAllHouseLandPackagesSchema,
  getHouseLandPackageDetailedInfoSchema,
} = require("./house-land-package.validation.js");

const { validateRequest } = require("../../middleware/validateRequestMiddleware.js");
const authMiddleware = require("../../middleware/authMiddleware.js");
const roleMiddleware = require("../../middleware/roleMiddleware.js");
const camelToSnakeMiddleware = require("../../middleware/caseConverterMiddleware.js");
const { REQUEST_SOURCE } = require("../../config/constants.js");
const { createImageOrPdfUpload, handleMulterError, createPdfUpload } = require("../../utils/s3Upload.js");

router.use(authMiddleware);
router.use(roleMiddleware);
router.use(camelToSnakeMiddleware);

const upload = createPdfUpload("house-land-package-attachments");

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
  "/details/:house_land_package_id",
  validateRequest(getHouseLandPackageDetailedInfoSchema, REQUEST_SOURCE.PARAMS),
  getHouseLandPackageDetailedInfo,
);

router.get(
  "/:house_land_package_id",
  validateRequest(getHouseLandPackageByIdSchema, REQUEST_SOURCE.PARAMS),
  getHouseLandPackageById,
);

router.put(
  "/:house_land_package_id",
  upload.fields([
    { name: "attachFiles", maxCount: 10},
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