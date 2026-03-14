const express = require("express");
const router = express.Router();

const {
  createRecalculateDate,
  getRecalculateDate,
  updateRecalculateDate,
} = require("./recalculate-date..controller.js");
const {
  createRecalculateDateSchema,
  updateRecalculateDateSchema,
} = require("./recalculate-date.validation.js");

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
  validateRequest(createRecalculateDateSchema, REQUEST_SOURCE.BODY),
  createRecalculateDate
);

router.get("/", getRecalculateDate);

router.put(
  "/",
  validateRequest(updateRecalculateDateSchema, REQUEST_SOURCE.BODY),
  updateRecalculateDate
);

module.exports = router;
