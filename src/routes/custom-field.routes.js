const express = require("express");
const router = express.Router();

const {
  createCustomField,
  getAllCustomFields,
  deleteCustomField,
  updateCustomField,
  updateCustomFieldIsActive,
} = require("../controllers/custom-field.controller");
const {
  createCustomFieldSchema,
  getAllCustomFieldSchema,
  deleteCustomFieldSchema,
  updateCustomFieldIdParamsSchema,
  updateCustomFieldSchema,
  updateCustomFieldIsActiveSchema,
} = require("../validations/custom-field.validation");

const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const { validateRequest } = require("../middleware/validateRequestMiddleware");
const { REQUEST_SOURCE } = require("../config/constants");

router.use(authMiddleware);
router.use(roleMiddleware);

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
module.exports = router;
