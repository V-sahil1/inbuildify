const express = require("express");
const router = express.Router();
const {
  getAllRanges,
  createRange,
  updateRange,
  deleteRange,
} = require("../controllers/range.controller");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const { validateRequest } = require("../middleware/validateRequestMiddleware");
const {
  getAllRangesSchema,
  createRangeSchema,
  updateRangeSchema,
  updateRangeParamsSchema,
  deleteRangeSchema,
} = require("../validations/range.validation.js");
const { REQUEST_SOURCE } = require("../config/constants");
const { createUpload, handleMulterError } = require("../utils/s3Upload");

router.use(authMiddleware);
router.use(roleMiddleware);

const upload = createUpload("range");

router.get(
  "/",
  validateRequest(getAllRangesSchema, REQUEST_SOURCE.QUERY),
  getAllRanges
);
router.post(
  "/",
  upload.fields([
    { name: "logo_image", maxCount: 1 },
    { name: "header_image", maxCount: 1 },
  ]),
  handleMulterError,
  validateRequest(createRangeSchema, REQUEST_SOURCE.FORM_DATA),
  createRange
);
router.put(
  "/:range_id",
  upload.fields([
    { name: "logo_image", maxCount: 1 },
    { name: "header_image", maxCount: 1 },
  ]),
  handleMulterError,
  validateRequest(updateRangeParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateRangeSchema, REQUEST_SOURCE.FORM_DATA),
  updateRange
);
router.delete(
  "/:range_id",
  validateRequest(deleteRangeSchema.params, REQUEST_SOURCE.PARAMS),
  deleteRange
);

module.exports = router;
