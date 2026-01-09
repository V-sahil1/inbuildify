const express = require("express");
const router = express.Router();

const {
  getConstructionEtsRechargeSettings,
  updateConstructionEtsRechargeSettings,
} = require("../controllers/construction-ets-recharge.controller");

const {
  updateConstructionEtsRechargeSettingsSchema,
} = require("../validations/construction-ets-recharge.validation");

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
  getConstructionEtsRechargeSettings
);

router.put(
  "/",
  validateRequest(updateConstructionEtsRechargeSettingsSchema, REQUEST_SOURCE.BODY),
  updateConstructionEtsRechargeSettings
);

module.exports = router;

