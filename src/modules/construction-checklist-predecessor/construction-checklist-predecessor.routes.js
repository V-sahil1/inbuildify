const express = require("express");
const router = express.Router();
const {
  createConstructionChecklistPredecessor,
  getAllConstructionChecklistPredecessors,
  getConstructionChecklistPredecessorById,
  updateConstructionChecklistPredecessor,
  deleteConstructionChecklistPredecessor,
} = require("./construction-checklist-predecessor.controller.js");
const {
  createConstructionChecklistPredecessorValidation,
  updateConstructionChecklistPredecessorValidation,
  getConstructionChecklistPredecessorByIdValidation,
  queryValidation,
} = require("./construction-checklist-predecessor.validation.js");
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
  validateRequest(createConstructionChecklistPredecessorValidation, REQUEST_SOURCE.BODY),
  createConstructionChecklistPredecessor
);

router.get(
  "/",
  validateRequest(queryValidation, REQUEST_SOURCE.QUERY),
  getAllConstructionChecklistPredecessors
);

router.get(
  "/:construction_checklist_predecessor_id",
  validateRequest(getConstructionChecklistPredecessorByIdValidation, REQUEST_SOURCE.PARAMS),
  getConstructionChecklistPredecessorById
);

router.put(
  "/:construction_checklist_predecessor_id",
  validateRequest(getConstructionChecklistPredecessorByIdValidation, REQUEST_SOURCE.PARAMS),
  validateRequest(updateConstructionChecklistPredecessorValidation, REQUEST_SOURCE.BODY),
  updateConstructionChecklistPredecessor
);

router.delete(
  "/:construction_checklist_predecessor_id",
  validateRequest(getConstructionChecklistPredecessorByIdValidation, REQUEST_SOURCE.PARAMS),
  deleteConstructionChecklistPredecessor
);

module.exports = router;