const express = require("express");
const router = express.Router();

const {
  createColorItemCustomField,
  getColorItemCustomFields,
  getColorItemCustomFieldById,
  updateColorItemCustomField,
  deleteColorItemCustomField,
} = require("./color-item-custom-field.controller");

const authMiddleware = require("../../middleware/authMiddleware");
const roleMiddleware = require("../../middleware/roleMiddleware");
const camelToSnakeMiddleware = require("../../middleware/caseConverterMiddleware");
const { validateRequest } = require("../../middleware/validateRequestMiddleware");
const { REQUEST_SOURCE } = require("../../config/constants");
const {
  createColorItemCustomFieldSchema,
  updateColorItemCustomFieldSchema,
} = require("./color-item-custom-field.validation");

router.use(authMiddleware);
router.use(roleMiddleware);

router.post(
  "/",
  camelToSnakeMiddleware,
  validateRequest(createColorItemCustomFieldSchema, REQUEST_SOURCE.BODY),
  createColorItemCustomField,
);

router.get("/", getColorItemCustomFields);

router.get("/:id", getColorItemCustomFieldById);

router.put(
  "/:id",
  camelToSnakeMiddleware,
  validateRequest(updateColorItemCustomFieldSchema, REQUEST_SOURCE.BODY),
  updateColorItemCustomField,
);

router.delete("/:id", deleteColorItemCustomField);

module.exports = router;
