const express = require("express");
const router = express.Router();
const {
  upsertBuilder,
  getMyBuilderProfile,
  getAllBuilders,
} = require("./builder.controller.js");

const authMiddleware = require("../../middleware/authMiddleware.js");
const roleMiddleware = require("../../middleware/roleMiddleware.js");
const camelToSnakeMiddleware = require("../../middleware/caseConverterMiddleware.js");
const parseFormDataJson = require("../../middleware/parseFormDataJson.js");
const { createUpload, handleMulterError } = require("../../utils/s3Upload.js");
const { validateRequest } = require("../../middleware/validateRequestMiddleware.js");
const { REQUEST_SOURCE } = require("../../config/constants.js");
const { upsertBuilderSchema } = require("./builder.validation.js");

router.use(authMiddleware);
router.use(roleMiddleware);
const upload = createUpload("builder-logo");

router.get("/all", getAllBuilders);
router.get("/", getMyBuilderProfile);
router.post(
  "/",
  upload.single("logo"),
  handleMulterError,
  parseFormDataJson,
  camelToSnakeMiddleware,
  validateRequest(upsertBuilderSchema, REQUEST_SOURCE.FORM_DATA),
  upsertBuilder,
);

module.exports = router;
