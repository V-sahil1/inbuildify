const express = require("express");
const router = express.Router();
const {
  createChecklist,
  getAllChecklist,
  deleteChecklist,
  updateChecklist,
  updateChecklistIsActive,
} = require("./checklist.controller.js");
const {
  createChecklistSchema,
  getAllChecklistSchema,
  deleteChecklistSchema,
  updateChecklistSchema,
  updateChecklistParamsSchema,
  updateChecklistIsActiveSchema,
} = require("./checklist.validation.js");

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
  validateRequest(createChecklistSchema, REQUEST_SOURCE.BODY),
  createChecklist
);

router.get("/", getAllChecklist);

router.get(
  "/:checklist_id",
  validateRequest(getAllChecklistSchema, REQUEST_SOURCE.PARAMS),
  getAllChecklist
);

router.delete(
  "/:checklist_id",
  validateRequest(deleteChecklistSchema, REQUEST_SOURCE.PARAMS),
  deleteChecklist
);

router.put(
  "/:checklist_id",
  validateRequest(updateChecklistParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateChecklistSchema, REQUEST_SOURCE.BODY),
  updateChecklist
);

router.put(
  "/is-active/:checklist_id",
  validateRequest(updateChecklistParamsSchema, REQUEST_SOURCE.PARAMS),
  updateChecklistIsActive
);

module.exports = router;
