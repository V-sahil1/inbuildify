const express = require("express");
const router = express.Router();

const {
  createConstructionOption,
  getAllConstructionOptions,
  deleteConstructionOption,
  updateConstructionOption,
} = require("./construction-option.controller.js");
const {
  createConstructionOptionSchema,
  deleteConstructionOptionSchema,
  updateConstructionOptionParamsSchema,
  updateConstructionOptionSchema,
} = require("./construction-option.validation.js");

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
  validateRequest(createConstructionOptionSchema, REQUEST_SOURCE.BODY),
  createConstructionOption,
);

router.get("/", getAllConstructionOptions);

router.delete(
  "/:id",
  validateRequest(deleteConstructionOptionSchema, REQUEST_SOURCE.PARAMS),
  deleteConstructionOption,
);

router.put(
  "/:id",
  validateRequest(updateConstructionOptionParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateConstructionOptionSchema, REQUEST_SOURCE.BODY),
  updateConstructionOption,
);

module.exports = router;
