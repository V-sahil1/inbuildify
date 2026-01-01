const express = require("express");
const router = express.Router();
const {
  createChecklist,
  getAllChecklist,
  deleteChecklist,
  updateChecklist,
  updateChecklistIsActive,
} = require("../controllers/checklist.controller");
const {
  createChecklistSchema,
  getAllChecklistSchema,
  deleteChecklistSchema,
  updateChecklistSchema,
  updateChecklistParamsSchema,
  updateChecklistIsActiveSchema,
} = require("../validations/checklist.validation");

const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const camelToSnakeMiddleware = require("../middleware/caseConverterMiddleware.js");

const { validateRequest } = require("../middleware/validateRequestMiddleware");
const { REQUEST_SOURCE } = require("../config/constants");

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
