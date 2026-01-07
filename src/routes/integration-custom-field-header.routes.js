const express = require("express");
const router = express.Router();

const {
  createIntegrationCustomFieldHeader,
  getAllIntegrationCustomFieldHeader,
  deleteIntegrationCustomFieldHeader,
  updateIntegrationCustomFieldHeader,
} = require("../controllers/integration-custom-field-header.controller");
const {
  createIntegrationCustomFieldHeaderSchema,
  getAllIntegrationCustomFieldHeaderSchema,
  deleteIntegrationCustomFieldHeaderSchema,
  updateIntegrationCustomFieldHeaderParamsSchema,
  updateIntegrationCustomFieldHeaderSchem,
} = require("../validations/integration-custom-field-header.validation");

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
  validateRequest(
    createIntegrationCustomFieldHeaderSchema,
    REQUEST_SOURCE.BODY
  ),
  createIntegrationCustomFieldHeader
);

router.get(
  "/",
  validateRequest(
    getAllIntegrationCustomFieldHeaderSchema,
    REQUEST_SOURCE.QUERY
  ),
  getAllIntegrationCustomFieldHeader
);

router.delete(
  "/:integration_custom_field_header_id",
  validateRequest(
    deleteIntegrationCustomFieldHeaderSchema,
    REQUEST_SOURCE.PARAMS
  ),
  deleteIntegrationCustomFieldHeader
);

router.put(
  "/:integration_custom_field_header_id",
  validateRequest(
    updateIntegrationCustomFieldHeaderParamsSchema,
    REQUEST_SOURCE.PARAMS
  ),
  validateRequest(updateIntegrationCustomFieldHeaderSchem, REQUEST_SOURCE.BODY),
  updateIntegrationCustomFieldHeader
);


module.exports = router;
