const express = require("express");
const router = express.Router();
const {
  createScreen,
  getScreens,
  deleteScreen,
  updateScreen,
} = require("../controllers/screen.controller");
const { validateRequest } = require("../middleware/validateRequestMiddleware");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

const { REQUEST_SOURCE } = require("../config/constants");
const {
  createScreenSchema,
  getScreenSchema,
  deleteScreenSchema,
  updateScreenParamsSchema,
  updateScreenSchema,
} = require("../validations/screen.validation");

router.use(authMiddleware);
router.use(roleMiddleware);

router.post(
  "/",
  validateRequest(createScreenSchema, REQUEST_SOURCE.BODY),
  createScreen
);

router.get(
  "/",
  validateRequest(getScreenSchema, REQUEST_SOURCE.QUERY),
  getScreens
);

router.delete(
  "/:screen_id",
  validateRequest(deleteScreenSchema, REQUEST_SOURCE.PARAMS),
  deleteScreen
);

router.put(
  "/:screen_id",
  validateRequest(updateScreenParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateScreenSchema, REQUEST_SOURCE.BODY),
  updateScreen
);

module.exports = router;
