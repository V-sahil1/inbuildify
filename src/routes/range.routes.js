const express = require("express");
const router = express.Router();
const {
  getAllRanges,
  createRange,
  updateRange,
  deleteRange
} = require("../controllers/range.controller");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const { validateRequest } = require("../middleware/validateRequestMiddleware");
const {
  getAllRangesSchema,
  createRangeSchema,
  updateRangeSchema,
  deleteRangeSchema
} = require("../validations/range.validation.js");
const { REQUEST_SOURCE } = require("../config/constants");

router.use(authMiddleware);
router.use(roleMiddleware);

router.get("/", validateRequest(getAllRangesSchema, REQUEST_SOURCE.QUERY), getAllRanges);
router.post("/", validateRequest(createRangeSchema, REQUEST_SOURCE.BODY), createRange)
router.put("/:range_id", validateRequest(updateRangeSchema.params, REQUEST_SOURCE.PARAMS), validateRequest(updateRangeSchema.body, REQUEST_SOURCE.BODY), updateRange)
router.delete("/:range_id", validateRequest(deleteRangeSchema.params, REQUEST_SOURCE.PARAMS), deleteRange)

module.exports = router;
