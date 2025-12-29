const express = require("express");
const router = express.Router();

const {
  createIntegrationCustomFieldItem,
  getAllIntegrationCustomFieldItem,
  deleteIntegrationCustomFieldItem,
  updateIntegrationCustomFieldItem,
  updateIntegrationCustomFieldItemIsActive,
} = require("../controllers/integration-custom-field-item.controller");
const {
  createIntegrationCustomFieldItemSchema,
  getAllIntegrationCustomFieldItemSchema,
  deleteIntegrationCustomFieldItemSchema,
  updateIntegrationCustomFieldParamsSchema,
  updateIntegrationCustoFieldItemSchema,
  updateIntegrationCustomFieldItemIsActiveSchema,
} = require("../validations/integration-custom-field-item.validation");

const { validateRequest } = require("../middleware/validateRequestMiddleware");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const camelToSnakeMiddleware = require("../middleware/caseConverterMiddleware.js");

const { REQUEST_SOURCE } = require("../config/constants");

router.use(authMiddleware);
router.use(roleMiddleware);
router.use(camelToSnakeMiddleware);

router.post(
  "/",
  validateRequest(createIntegrationCustomFieldItemSchema, REQUEST_SOURCE.BODY),
  createIntegrationCustomFieldItem
);

router.get(
  "/",
  validateRequest(getAllIntegrationCustomFieldItemSchema, REQUEST_SOURCE.QUERY),
  getAllIntegrationCustomFieldItem
);

router.delete(
  "/:integration_custom_field_item_id",
  validateRequest(
    deleteIntegrationCustomFieldItemSchema,
    REQUEST_SOURCE.PARAMS
  ),
  deleteIntegrationCustomFieldItem
);

router.put(
  "/:integration_custom_field_item_id",
  validateRequest(
    updateIntegrationCustomFieldParamsSchema,
    REQUEST_SOURCE.PARAMS
  ),
  validateRequest(updateIntegrationCustoFieldItemSchema, REQUEST_SOURCE.BODY),
  updateIntegrationCustomFieldItem
);

router.put(
  "/is-active/:integration_custom_field_item_id",
  validateRequest(
    updateIntegrationCustomFieldParamsSchema,
    REQUEST_SOURCE.PARAMS
  ),
  validateRequest(
    updateIntegrationCustomFieldItemIsActiveSchema,
    REQUEST_SOURCE.BODY
  ),
  updateIntegrationCustomFieldItemIsActive
);

module.exports = router;
