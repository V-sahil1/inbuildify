const express = require("express");
const router = express.Router();
const {
  createChecklistItem,
  getAllChecklistItem,
  getChecklistItemsByChecklistId,
  deleteChecklistItem,
  updateChecklistItem,
} = require("./checklist-item.controller.js");
const {
  createChecklistItemSchema,
  getAllChecklistItemSchema,
  getChecklistItemsByChecklistIdSchema,
  deleteChecklistItemSchema,
  updateChecklistItemParamsSchema,
  updateChecklistItemSchema,
} = require("./checklist-item.validation.js");

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
  validateRequest(createChecklistItemSchema, REQUEST_SOURCE.BODY),
  createChecklistItem
);

router.get(
  "/",
  validateRequest(getAllChecklistItemSchema, REQUEST_SOURCE.QUERY),
  getAllChecklistItem
);

router.get(
  "/:checklist_id",
  validateRequest(getChecklistItemsByChecklistIdSchema, REQUEST_SOURCE.PARAMS),
  getChecklistItemsByChecklistId
);

router.delete(
  "/:checklist_item_id",
  validateRequest(deleteChecklistItemSchema, REQUEST_SOURCE.PARAMS),
  deleteChecklistItem
);

router.put(
  "/:checklist_item_id",
  validateRequest(updateChecklistItemParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateChecklistItemSchema, REQUEST_SOURCE.BODY),
  updateChecklistItem
);

module.exports = router;
