const express = require("express");
const router = express.Router();
const {
  createScreen,
  getScreens,
  deleteScreen,
  updateScreen,
} = require("./screen.controller.js");
const { validateRequest } = require("../../middleware/validateRequestMiddleware.js");
const authMiddleware = require("../../middleware/authMiddleware.js");
const roleMiddleware = require("../../middleware/roleMiddleware.js");
const camelToSnakeMiddleware = require("../../middleware/caseConverterMiddleware.js");

const { REQUEST_SOURCE } = require("../../config/constants.js");
const {
  createScreenSchema,
  deleteScreenSchema,
  updateScreenParamsSchema,
  updateScreenSchema,
} = require("./screen.validation.js");

router.use(authMiddleware);
router.use(roleMiddleware);
router.use(camelToSnakeMiddleware);

router.post(
  "/",
  validateRequest(createScreenSchema, REQUEST_SOURCE.BODY),
  createScreen
);

router.get("/", getScreens);

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
