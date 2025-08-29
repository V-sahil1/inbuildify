const express = require("express");
const router = express.Router();
const {
  getAllRanges
} = require("../controllers/range.controller");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const { validateRequest } = require("../middleware/validateRequestMiddleware");
const {
  getAllRangesSchema,
} = require("../validations/range.validation.js");
const { REQUEST_SOURCE } = require("../config/constants");

router.use(authMiddleware);
router.use(roleMiddleware);

router.get("/", validateRequest(getAllRangesSchema, REQUEST_SOURCE.QUERY), getAllRanges);

module.exports = router;
