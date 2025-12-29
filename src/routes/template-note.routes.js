const express = require("express");
const router = express.Router();

const {
  createTemplateNote,
  getAllTemplateNotes,
  deleteTemplateNote,
  updateTemplateNote,
  updateTemplateNoteIsActive,
} = require("../controllers/template-note.controller");
const {
  createTemplateNoteSchema,
  getAllTemplateNotesSchema,
  deleteTemplateNoteSchema,
  updateTemplateNoteParamsSchema,
  updateTemplateNoteSchema,
  updateTemplateNoteIsActiveSchema,
} = require("../validations/template-note.validation");
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
  validateRequest(createTemplateNoteSchema, REQUEST_SOURCE.BODY),
  createTemplateNote
);

router.get(
  "/",
  validateRequest(getAllTemplateNotesSchema, REQUEST_SOURCE.QUERY),
  getAllTemplateNotes
);

router.delete(
  "/:template_note_id",
  validateRequest(deleteTemplateNoteSchema, REQUEST_SOURCE.PARAMS),
  deleteTemplateNote
);

router.put(
  "/:template_note_id",
  validateRequest(updateTemplateNoteParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateTemplateNoteSchema, REQUEST_SOURCE.BODY),
  updateTemplateNote
);

router.put(
  "/is-active/:template_note_id",
  validateRequest(updateTemplateNoteParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateTemplateNoteIsActiveSchema, REQUEST_SOURCE.BODY),
  updateTemplateNoteIsActive
);
module.exports = router;
