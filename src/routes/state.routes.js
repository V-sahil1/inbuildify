const express = require("express");
const router = express.Router();
const { getState } = require("../controllers/state.controller");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const { validateRequest } = require("../middleware/validateRequestMiddleware");
const { getStateSchema } = require("../validations/state.validation");
const { REQUEST_SOURCE } = require("../config/constants");

router.use(authMiddleware);
router.use(roleMiddleware);

router.get("/:country_id", validateRequest(getStateSchema, REQUEST_SOURCE.PARAMS), getState);

module.exports = router;