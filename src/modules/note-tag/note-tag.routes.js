const express = require("express");
const router = express.Router();

const {
  createNotesTag,
  getAllNoteTag,
  deleteNoteTag,
  updateNoteTag,
  updateNoteTagIsActive,
} = require("./note-tag.controller.js");
const {
  createNoteTageSchema,
  getAllNoteTagSchema,
  deleteNoteTagSchema,
  updateNoteTagIdParamsSchema,
  updateNoteTagSchema,
  updateNoteTagIsActiveSchema,
} = require("./note-tag.validation.js");

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
