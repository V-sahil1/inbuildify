const express = require("express");
const router = express.Router();

const {
  createHoliday,
  getAllHolidays,
  deleteHoliday,
  updateHoliday,
} = require("../controllers/holiday.controller");
const {
  createHolidaySchema,
  getAllHolidaySchema,
  deleteHolidaySchema,
  updateHolidayParamsSchema,
  updateHolidaySchema,
} = require("../validations/holiday.validation");

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
  validateRequest(createHolidaySchema, REQUEST_SOURCE.BODY),
  createHoliday
);

router.get(
  "/",
  validateRequest(getAllHolidaySchema, REQUEST_SOURCE.QUERY),
  getAllHolidays
);

router.delete(
  "/:id",
  validateRequest(deleteHolidaySchema, REQUEST_SOURCE.PARAMS),
  deleteHoliday
);

router.put(
  "/:holiday_id",
  validateRequest(updateHolidayParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateHolidaySchema, REQUEST_SOURCE.BODY),
  updateHoliday
);

module.exports = router;
