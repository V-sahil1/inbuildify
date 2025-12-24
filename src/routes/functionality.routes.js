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
  getAllFunctionalityByScreenIdSchema,
} = require("../validations/functionality.validation");

const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const { validateRequest } = require("../middleware/validateRequestMiddleware");
const { REQUEST_SOURCE } = require("../config/constants");
const { route } = require("./checklist.routes");

router.use(authMiddleware);
router.use(roleMiddleware);

router.post(
  "/",
  validateRequest(createFunctionalitySchema, REQUEST_SOURCE.BODY),
  createFunctionality
);

router.get(
  "/",
  validateRequest(getFunctionalitiesSchema, REQUEST_SOURCE.QUERY),
  getFunctionalities
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

router.get(
  "/fetch",
  validateRequest(getAllFunctionalityByScreenIdSchema, REQUEST_SOURCE.QUERY),
  getFunctionalitiesByScreen
);

module.exports = router;
