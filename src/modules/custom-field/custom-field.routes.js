const express = require("express");
const router = express.Router();

const {
  createCustomField,
  getAllCustomFields,
  deleteCustomField,
  updateCustomField,
  updateCustomFieldIsActive,
  createOption,
  deleteOption,
} = require("./custom-field.controller.js");
const {
  createCustomFieldSchema,
  getAllCustomFieldSchema,
  deleteCustomFieldSchema,
  updateCustomFieldIdParamsSchema,
  updateCustomFieldSchema,
  updateCustomFieldIsActiveSchema,
  createOptionSchema,
  deleteOptionParamsSchema,
  deleteOptionSchema,
} = require("./custom-field.validation.js");

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
  validateRequest(createCustomFieldSchema, REQUEST_SOURCE.BODY),
  createCustomField
);

router.get(
  "/",
  validateRequest(getAllCustomFieldSchema, REQUEST_SOURCE.QUERY),
  getAllCustomFields
);

router.delete(
  "/:id",
  validateRequest(deleteCustomFieldSchema, REQUEST_SOURCE.PARAMS),
  deleteCustomField
);

router.put(
  "/:id",
  validateRequest(updateCustomFieldIdParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateCustomFieldSchema, REQUEST_SOURCE.BODY),
  updateCustomField
);

router.put(
  "/is-active/:id",
  validateRequest(updateCustomFieldIdParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateCustomFieldIsActiveSchema, REQUEST_SOURCE.BODY),
  updateCustomFieldIsActive
);

router.post(
  "/option",
  validateRequest(createOptionSchema, REQUEST_SOURCE.BODY),
  createOption
);

router.delete(
  "/option/:custom_field_id",
  validateRequest(deleteOptionParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(deleteOptionSchema, REQUEST_SOURCE.BODY),
  deleteOption
),
  (module.exports = router);
