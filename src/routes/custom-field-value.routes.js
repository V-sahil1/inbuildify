const express = require("express");
const router = express.Router();

const {
  createCustomFieldValue,
  getAllCustomFieldValue,
  deleteCustomFieldValue,
  updateCustomFieldValue,
} = require("../controllers/custom-field-value.controller");
const {
  createCustomFieldValueSchema,
  getAllCustomFieldValueSchema,
  deleteCustomFieldValueSchema,
  updateCustomFieldValueIdParamsSchema,
  updateCustomFieldValueSchema,
} = require("../validations/custom-field-value.validation");

const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const { validateRequest } = require("../middleware/validateRequestMiddleware");
const { REQUEST_SOURCE } = require("../config/constants");
const e = require("express");

router.use(authMiddleware);
router.use(roleMiddleware);

router.post(
  "/",
  validateRequest(createCustomFieldValueSchema, REQUEST_SOURCE.BODY),
  createCustomFieldValue
);

router.get(
  "/",
  validateRequest(getAllCustomFieldValueSchema, REQUEST_SOURCE.QUERY),
  getAllCustomFieldValue
);

router.delete(
  "/:custom_field_value_id",
  validateRequest(deleteCustomFieldValueSchema, REQUEST_SOURCE.PARAMS),
  deleteCustomFieldValue
);

router.put(
  "/:custom_field_value_id",
  validateRequest(updateCustomFieldValueIdParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateCustomFieldValueSchema, REQUEST_SOURCE.BODY),
  updateCustomFieldValue
);

module.exports = router;
