const express = require("express");
const router = express.Router();

const { getAllTimezones } = require("./timezone.controller.js");
const { getAllTimezoneSchema } = require("./timezone.validation.js");

const { validateRequest } = require("../../middleware/validateRequestMiddleware.js");
const authMiddleware = require("../../middleware/authMiddleware.js");
const roleMiddleware = require("../../middleware/roleMiddleware.js");
const camelToSnakeMiddleware = require("../../middleware/caseConverterMiddleware.js");

const { REQUEST_SOURCE } = require("../../config/constants.js");

router.use(authMiddleware);
router.use(roleMiddleware);
router.use(camelToSnakeMiddleware);

router.get(
  "/",
  validateRequest(getAllTimezoneSchema, REQUEST_SOURCE.QUERY),
  getAllTimezones
);

module.exports = router;
