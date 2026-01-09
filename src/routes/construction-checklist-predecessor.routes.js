const express = require("express");
const router = express.Router();
const {
  createConstructionChecklistPredecessor,
  getAllConstructionChecklistPredecessors,
  getConstructionChecklistPredecessorById,
  updateConstructionChecklistPredecessor,
  deleteConstructionChecklistPredecessor,
} = require("../controllers/construction-checklist-predecessor.controller");
const {
  createConstructionChecklistPredecessorValidation,
  updateConstructionChecklistPredecessorValidation,
  getConstructionChecklistPredecessorByIdValidation,
  queryValidation,
} = require("../validations/construction-checklist-predecessor.validation");
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