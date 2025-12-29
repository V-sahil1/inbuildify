const express = require("express");
const router = express.Router();
const {
  createBuilder,
  getBuilders,
  getBuilderById,
  updateBuilder,
  deleteBuilder,
} = require("../controllers/builder.controller");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const camelToSnakeMiddleware = require("../middleware/caseConverterMiddleware.js");
const { createUpload, handleMulterError } = require("../utils/s3Upload");
const { validateRequest } = require("../middleware/validateRequestMiddleware");
const { REQUEST_SOURCE } = require("../config/constants");
const { updateBuilderSchema } = require("../validations/builder.validation");

router.use(authMiddleware);
router.use(roleMiddleware);
const upload = createUpload("builder-logo");

router.post("/", createBuilder);
router.get("/", getBuilders);
router.get("/:id", getBuilderById);
router.put(
  "/",
  upload.single("image"),
  handleMulterError,
  camelToSnakeMiddleware,
  validateRequest(updateBuilderSchema, REQUEST_SOURCE.FORM_DATA),
  updateBuilder
);
router.delete("/:id", deleteBuilder);

module.exports = router;
