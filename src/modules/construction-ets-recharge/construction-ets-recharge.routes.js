const express = require("express");
const router = express.Router();

const {
  getConstructionEtsRechargeSettings,
  updateConstructionEtsRechargeSettings,
} = require("./construction-ets-recharge.controller.js");

const {
  updateConstructionEtsRechargeSettingsSchema,
} = require("./construction-ets-recharge.validation.js");

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
  getConstructionEtsRechargeSettings
);

router.put(
  "/",
  validateRequest(updateConstructionEtsRechargeSettingsSchema, REQUEST_SOURCE.BODY),
  updateConstructionEtsRechargeSettings
);

module.exports = router;

