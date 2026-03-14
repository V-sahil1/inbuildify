const express = require("express");
const router = express.Router();

const {
  createTemplateNote,
  getAllTemplateNotes,
  deleteTemplateNote,
  updateTemplateNote,
  updateTemplateNoteIsActive,
} = require("./template-note.controller.js");
const {
  createTemplateNoteSchema,
  getAllTemplateNotesSchema,
  deleteTemplateNoteSchema,
  updateTemplateNoteParamsSchema,
  updateTemplateNoteSchema,
  updateTemplateNoteIsActiveSchema,
} = require("./template-note.validation.js");
const { validateRequest } = require("../../middleware/validateRequestMiddleware.js");
const authMiddleware = require("../../middleware/authMiddleware.js");
const roleMiddleware = require("../../middleware/roleMiddleware.js");
const camelToSnakeMiddleware = require("../../middleware/caseConverterMiddleware.js");

const { REQUEST_SOURCE } = require("../../config/constants.js");

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
  updateTemplateNoteIsActive
);
module.exports = router;
