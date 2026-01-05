const express = require("express");
const router = express.Router();
const {
  upsertBuilder,
  getMyBuilderProfile,
} = require("../controllers/builder.controller");

const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const camelToSnakeMiddleware = require("../middleware/caseConverterMiddleware.js");
const parseFormDataJson = require("../middleware/parseFormDataJson.js");
const { createUpload, handleMulterError } = require("../utils/s3Upload");
const { validateRequest } = require("../middleware/validateRequestMiddleware");
const { REQUEST_SOURCE } = require("../config/constants");
const { upsertBuilderSchema } = require("../validations/builder.validation");

router.use(authMiddleware);
router.use(roleMiddleware);
const upload = createUpload("builder-logo");

router.get("/", getMyBuilderProfile);
router.post(
  "/",
  upload.single("logo"),
  handleMulterError,
  parseFormDataJson,
  camelToSnakeMiddleware,
  validateRequest(upsertBuilderSchema, REQUEST_SOURCE.FORM_DATA),
  upsertBuilder
);

module.exports = router;
