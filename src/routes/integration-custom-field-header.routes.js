const express = require("express");
const router = express.Router();

const {
  createIntegrationCustomFieldHeader,
  getAllIntegrationCustomFieldHeader,
  deleteIntegrationCustomFieldHeader,
  updateIntegrationCustomFieldHeader,
  updateIntegrationCustomFieldHeaderIsActive,
} = require("../controllers/integration-custom-field-header.controller");
const {
  createIntegrationCustomFieldHeaderSchema,
  getAllIntegrationCustomFieldHeaderSchema,
  deleteIntegrationCustomFieldHeaderSchema,
  updateIntegrationCustomFieldHeaderParamsSchema,
  updateIntegrationCustomFieldHeaderSchem,
  updateIntegrationCustomFieldHeaderIsActiveSchema,
} = require("../validations/integration-custom-field-header.validation");

const { validateRequest } = require("../middleware/validateRequestMiddleware");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

const { REQUEST_SOURCE } = require("../config/constants");

router.use(authMiddleware);
router.use(roleMiddleware);

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

router.put(
  "/is-active/:integration_custom_field_header_id",
  validateRequest(
    updateIntegrationCustomFieldHeaderParamsSchema,
    REQUEST_SOURCE.PARAMS
  ),
  validateRequest(
    updateIntegrationCustomFieldHeaderIsActiveSchema,
    REQUEST_SOURCE.BODY
  ),
  updateIntegrationCustomFieldHeaderIsActive
);
module.exports = router;
