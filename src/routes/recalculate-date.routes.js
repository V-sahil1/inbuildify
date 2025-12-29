const express = require("express");
const router = express.Router();

const {
  createRecalculateDate,
  getRecalculateDate,
  updateRecalculateDate,
} = require("../controllers/recalculate-date..controller");
const {
  createRecalculateDateSchema,
  updateRecalculateDateParamsSchema,
  updateRecalculateDateSchema,
} = require("../validations/recalculate-date.validation");

const { validateRequest } = require("../middleware/validateRequestMiddleware");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const camelToSnakeMiddleware = require("../middleware/caseConverterMiddleware.js");

const { REQUEST_SOURCE } = require("../config/constants");

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
  "/:recalculate_date_id",
  validateRequest(updateRecalculateDateParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateRecalculateDateSchema, REQUEST_SOURCE.BODY),
  updateRecalculateDate
);

module.exports = router;
