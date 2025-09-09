const express = require("express");
const router = express.Router();
const {
  createAction,
  getAction,
} = require("../controllers/actions.controller.js");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const { validateRequest } = require("../middleware/validateRequestMiddleware");
const {
  createActionSchema,
  getActionSchema,
} = require("../validations/actions.validation.js");
const { REQUEST_SOURCE } = require("../config/constants");

router.use(authMiddleware);
router.use(roleMiddleware);

router.post("/:lead_id", validateRequest(createActionSchema.params, REQUEST_SOURCE.PARAMS), validateRequest(createActionSchema.body, REQUEST_SOURCE.BODY), createAction);
router.get("/:lead_id", validateRequest(getActionSchema.params, REQUEST_SOURCE.PARAMS), validateRequest(getActionSchema.query, REQUEST_SOURCE.QUERY), getAction);
  

module.exports = router;
