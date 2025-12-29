const express = require("express");
const router = express.Router();

const {
  createCustomFieldModule,
  getAllCustomFieldModule,
  deleteCustomFieldModule,
  updateCustomFieldModule,
} = require("../controllers/custom-field-module.controller");
const {
  createCustomFieldModuleSchema,
  getAllCustomFieldModuleSchema,
  deleteCustomFieldModuleSchema,
  updateCustomFieldModuleIdParamsSchema,
  updateCustomFieldModuleSchema,
} = require("../validations/custom-field-module.validation");

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
  validateRequest(createCustomFieldModuleSchema, REQUEST_SOURCE.BODY),
  createCustomFieldModule
);

router.get(
  "/",
  validateRequest(getAllCustomFieldModuleSchema, REQUEST_SOURCE.QUERY),
  getAllCustomFieldModule
);

router.delete(
  "/:module_id",
  validateRequest(deleteCustomFieldModuleSchema, REQUEST_SOURCE.PARAMS),
  deleteCustomFieldModule
);

router.put(
  "/:module_id",
  validateRequest(updateCustomFieldModuleIdParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateCustomFieldModuleSchema, REQUEST_SOURCE.BODY),
  updateCustomFieldModule
);

module.exports = router;
