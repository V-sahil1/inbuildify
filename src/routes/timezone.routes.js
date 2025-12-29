const express = require("express");
const router = express.Router();

const { getAllTimezones } = require("../controllers/timezone.controller");
const { getAllTimezoneSchema } = require("../validations/timezone.validation");

const { validateRequest } = require("../middleware/validateRequestMiddleware");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const camelToSnakeMiddleware = require("../middleware/caseConverterMiddleware.js");

const { REQUEST_SOURCE } = require("../config/constants");

router.use(authMiddleware);
router.use(roleMiddleware);
router.use(camelToSnakeMiddleware);

router.get(
  "/",
  validateRequest(getAllTimezoneSchema, REQUEST_SOURCE.QUERY),
  getAllTimezones
);

module.exports = router;
