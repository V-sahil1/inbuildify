const express = require("express");
const router = express.Router();

const {
  createEstate,
  getAllEstate,
  deleteEstate,
  updateEstate,
} = require("../controllers/estate.controller");
const {
  createEstateSchema,
  getAllEstateSchema,
  deleteEstateSchema,
  updateEstateParamsSchema,
  updateEstateSchema,
} = require("../validations/estate.validation");

const { validateRequest } = require("../middleware/validateRequestMiddleware");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const camelToSnakeMiddleware = require("../middleware/caseConverterMiddleware.js");

const { createUpload, handleMulterError } = require("../utils/s3Upload");

const { REQUEST_SOURCE } = require("../config/constants");

router.use(authMiddleware);
router.use(roleMiddleware);

const upload = createUpload("estate");

router.post(
  "/",
  upload.single("estateLogo"),
  handleMulterError,
  camelToSnakeMiddleware,
  validateRequest(createEstateSchema, REQUEST_SOURCE.FORM_DATA),
  createEstate,
);

router.get(
  "/",
  camelToSnakeMiddleware,
  validateRequest(getAllEstateSchema, REQUEST_SOURCE.QUERY),
  getAllEstate,
);

router.delete(
  "/:estate_id",
  camelToSnakeMiddleware,
  validateRequest(deleteEstateSchema, REQUEST_SOURCE.PARAMS),
  deleteEstate,
);

router.put(
  "/:estate_id",
  upload.single("estateLogo"),
  handleMulterError,
  camelToSnakeMiddleware,
  validateRequest(updateEstateParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateEstateSchema, REQUEST_SOURCE.BODY),
  updateEstate,
);

module.exports = router;
