const express = require("express");
const router = express.Router();
const {
  createFunctionality,
  getFunctionalities,
  deleteFunctionality,
  updateFunctionality,
  getFunctionalitiesByScreen,
} = require("../controllers/functionality.controller");
const {
  createFunctionalitySchema,
  getFunctionalitiesSchema,
  deleteFunctionalitySchema,
  updateFunctionalityParamsSchema,
  updateFunctionalitySchema,
  getFunctionalitiesByScreenSchema,
} = require("../validations/functionality.validation");

const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const camelToSnakeMiddleware = require("../middleware/caseConverterMiddleware.js");

const { validateRequest } = require("../middleware/validateRequestMiddleware");
const { REQUEST_SOURCE } = require("../config/constants");

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
