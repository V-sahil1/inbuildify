const express = require("express");
const router = express.Router();
const {
  createFunctionality,
  getFunctionalities,
  deleteFunctionality,
  updateFunctionality,
  getFunctionalitiesByScreen,
} = require("./functionality.controller.js");
const {
  createFunctionalitySchema,
  getFunctionalitiesSchema,
  deleteFunctionalitySchema,
  updateFunctionalityParamsSchema,
  updateFunctionalitySchema,
  getFunctionalitiesByScreenSchema,
} = require("./functionality.validation.js");

const authMiddleware = require("../../middleware/authMiddleware.js");
const roleMiddleware = require("../../middleware/roleMiddleware.js");
const camelToSnakeMiddleware = require("../../middleware/caseConverterMiddleware.js");

const { validateRequest } = require("../../middleware/validateRequestMiddleware.js");
const { REQUEST_SOURCE } = require("../../config/constants.js");

router.use(authMiddleware);
router.use(roleMiddleware);
router.use(camelToSnakeMiddleware);

router.post(
  "/",
  validateRequest(createFunctionalitySchema, REQUEST_SOURCE.BODY),
  createFunctionality
);

router.get("/", getFunctionalities);

router.get(
  "/:screenId",
  validateRequest(getFunctionalitiesByScreenSchema, REQUEST_SOURCE.PARAMS),
  getFunctionalitiesByScreen
);

router.delete(
  "/:functionality_id",
  validateRequest(deleteFunctionalitySchema, REQUEST_SOURCE.PARAMS),
  deleteFunctionality
);

router.put(
  "/:functionality_id",
  validateRequest(updateFunctionalityParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateFunctionalitySchema, REQUEST_SOURCE.BODY),
  updateFunctionality
);

module.exports = router;
