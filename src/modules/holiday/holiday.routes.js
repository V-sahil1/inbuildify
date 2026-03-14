const express = require("express");
const router = express.Router();

const {
  createHoliday,
  getAllHolidays,
  deleteHoliday,
  updateHoliday,
  toggleHolidayStatus,
} = require("./holiday.controller.js");
const {
  createHolidaySchema,
  getAllHolidaySchema,
  deleteHolidaySchema,
  updateHolidayParamsSchema,
  updateHolidaySchema,
} = require("./holiday.validation.js");

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

router.put(
  "/is-active/:holiday_id",
  validateRequest(updateHolidayParamsSchema, REQUEST_SOURCE.PARAMS),
  toggleHolidayStatus
);

module.exports = router;
