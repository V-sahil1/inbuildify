const express = require("express");
const router = express.Router();

const {
  createNotesTag,
  getAllNoteTag,
  deleteNoteTag,
  updateNoteTag,
  updateNoteTagIsActive,
} = require("../controllers/note-tag.controller");
const {
  createNoteTageSchema,
  getAllNoteTagSchema,
  deleteNoteTagSchema,
  updateNoteTagIdParamsSchema,
  updateNoteTagSchema,
  updateNoteTagIsActiveSchema,
} = require("../validations/note-tag.validation");

const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const { validateRequest } = require("../middleware/validateRequestMiddleware");
const { REQUEST_SOURCE } = require("../config/constants");

router.use(authMiddleware);
router.use(roleMiddleware);

router.post(
  "/",
  validateRequest(createNoteTageSchema, REQUEST_SOURCE.BODY),
  createNotesTag
);

router.get(
  "/",
  validateRequest(getAllNoteTagSchema, REQUEST_SOURCE.PARAMS),
  getAllNoteTag
);

router.delete(
  "/:id",
  validateRequest(deleteNoteTagSchema, REQUEST_SOURCE.PARAMS),
  deleteNoteTag
);

router.put(
  "/:id",
  validateRequest(updateNoteTagIdParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateNoteTagSchema, REQUEST_SOURCE.BODY),
  updateNoteTag
);

router.put(
  "/is-active/:id",
  validateRequest(updateNoteTagIdParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateNoteTagIsActiveSchema, REQUEST_SOURCE.BODY),
  updateNoteTagIsActive
);

module.exports = router;
