const express = require("express");
const router = express.Router();

const {
  createTemplateNote,
  getAllTemplateNotes,
  deleteTemplateNote,
  updateTemplateNote,
} = require("../controllers/template-note.controller");
const {
  createTemplateNoteSchema,
  getAllTemplateNotesSchema,
  deleteTemplateNoteSchema,
  updateTemplateNoteParamsSchema,
  updateTemplateNoteSchema,
} = require("../validations/template-note.validation");
const { validateRequest } = require("../middleware/validateRequestMiddleware");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

const { REQUEST_SOURCE } = require("../config/constants");

router.use(authMiddleware);
router.use(roleMiddleware);

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
module.exports = router;
