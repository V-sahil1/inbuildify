const express = require("express");
const router = express.Router();

const {
  createIntegrationCustomFieldItem,
  getAllIntegrationCustomFieldItem,
  deleteIntegrationCustomFieldItem,
  updateIntegrationCustomFieldItem,
} = require("./integration-custom-field-item.controller.js");
const {
  createIntegrationCustomFieldItemSchema,
  getAllIntegrationCustomFieldItemSchema,
  deleteIntegrationCustomFieldItemSchema,
  updateIntegrationCustomFieldParamsSchema,
  updateIntegrationCustoFieldItemSchema,
} = require("./integration-custom-field-item.validation.js");

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



module.exports = router;
