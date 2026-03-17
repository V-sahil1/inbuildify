import express from "express";

const router = express.Router();

import {
  createTemplateNote,
  getAllTemplateNotes,
  deleteTemplateNote,
  updateTemplateNote,
  updateTemplateNoteIsActive,
} from "./template-note.controller.js";
import {
  createTemplateNoteSchema,
  getAllTemplateNotesSchema,
  deleteTemplateNoteSchema,
  updateTemplateNoteParamsSchema,
  updateTemplateNoteSchema,
  updateTemplateNoteIsActiveSchema,
} from "./template-note.validation.js";
import { validateRequest } from "../../middleware/validateRequestMiddleware.js";
import authMiddleware from "../../middleware/authMiddleware.js";
import roleMiddleware from "../../middleware/roleMiddleware.js";
import camelToSnakeMiddleware from "../../middleware/caseConverterMiddleware.js";
import { REQUEST_SOURCE } from "../../config/constants.js";

router.use(authMiddleware);
router.use(roleMiddleware);
router.use(camelToSnakeMiddleware);

router.post(
  "/",
  validateRequest(createTemplateNoteSchema, REQUEST_SOURCE.BODY),
  createTemplateNote,
);

router.get(
  "/",
  validateRequest(getAllTemplateNotesSchema, REQUEST_SOURCE.QUERY),
  getAllTemplateNotes,
);

router.delete(
  "/:template_note_id",
  validateRequest(deleteTemplateNoteSchema, REQUEST_SOURCE.PARAMS),
  deleteTemplateNote,
);

router.put(
  "/:template_note_id",
  validateRequest(updateTemplateNoteParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateTemplateNoteSchema, REQUEST_SOURCE.BODY),
  updateTemplateNote,
);

router.put(
  "/is-active/:template_note_id",
  validateRequest(updateTemplateNoteParamsSchema, REQUEST_SOURCE.PARAMS),
  updateTemplateNoteIsActive,
);
export default router;
