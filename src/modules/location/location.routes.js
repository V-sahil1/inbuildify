const express = require("express");
const router = express.Router();

const {
  createLocation,
  getAllLocation,
  deleteLocation,
  updateLocation,
} = require("./location.controller.js");
const {
  createLocationSchema,
  deleteLocationSchema,
  updateLocationParamsSchema,
  updateLocationShema,
  getAllLocationSchema,
} = require("./location.validation.js");

const { validateRequest } = require("../../middleware/validateRequestMiddleware.js");
const authMiddleware = require("../../middleware/authMiddleware.js");
const roleMiddleware = require("../../middleware/roleMiddleware.js");
const camelToSnakeMiddleware = require("../../middleware/caseConverterMiddleware.js");

const { REQUEST_SOURCE } = require("../../config/constants.js");

router.use(authMiddleware);
router.use(roleMiddleware);
router.use(camelToSnakeMiddleware);

router.post(
  "/",
  validateRequest(createLocationSchema, REQUEST_SOURCE.BODY),
  createLocation,
);

router.get(
  "/",
  validateRequest(getAllLocationSchema, REQUEST_SOURCE.QUERY),
  getAllLocation,
);

router.delete(
  "/:location_id",
  validateRequest(deleteLocationSchema, REQUEST_SOURCE.PARAMS),
  deleteLocation,
);

router.put(
  "/:location_id",
  validateRequest(updateLocationParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateLocationShema, REQUEST_SOURCE.BODY),
  updateLocation,
);

module.exports = router;
