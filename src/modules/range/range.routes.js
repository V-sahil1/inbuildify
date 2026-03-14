const express = require("express");
const router = express.Router();
const {
  getAllRanges,
  createRange,
  updateRange,
  deleteRange,
  updateRangeActive,
} = require("./range.controller.js");

const authMiddleware = require("../../middleware/authMiddleware.js");
const roleMiddleware = require("../../middleware/roleMiddleware.js");
const { validateRequest } = require("../../middleware/validateRequestMiddleware.js");
const {
  createRangeSchema,
  updateRangeSchema,
  updateRangeParamsSchema,
  deleteRangeSchema,
  updateRangeActiveSchema,
} = require("./range.validation.js");

const camelToSnakeMiddleware = require("../../middleware/caseConverterMiddleware.js");
const { REQUEST_SOURCE } = require("../../config/constants.js");
const { createUpload, handleMulterError } = require("../../utils/s3Upload.js");

router.use(authMiddleware);
router.use(roleMiddleware);
const upload = createUpload("range");

router.get("/", camelToSnakeMiddleware, getAllRanges);
router.post(
  "/",
  upload.fields([
    { name: "logoUrl", maxCount: 1 },
    { name: "headerUrl", maxCount: 1 },
  ]),
  handleMulterError,
  camelToSnakeMiddleware,
  validateRequest(createRangeSchema, REQUEST_SOURCE.FORM_DATA),
  createRange,
);
router.put(
  "/:range_id",
  upload.fields([
    { name: "logoUrl", maxCount: 1 },
    { name: "headerUrl", maxCount: 1 },
  ]),
  handleMulterError,
  camelToSnakeMiddleware,
  validateRequest(updateRangeParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateRangeSchema, REQUEST_SOURCE.FORM_DATA),
  updateRange,
);
router.delete(
  "/:range_id",
  camelToSnakeMiddleware,
  validateRequest(deleteRangeSchema.params, REQUEST_SOURCE.PARAMS),
  deleteRange,
);

router.put(
  "/is-active/:range_id",
  camelToSnakeMiddleware,
  validateRequest(updateRangeParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateRangeActiveSchema, REQUEST_SOURCE.BODY),
  updateRangeActive,
);

module.exports = router;
