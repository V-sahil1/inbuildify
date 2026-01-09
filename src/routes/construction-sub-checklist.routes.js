const express = require("express");
const router = express.Router();
const {
  createConstructionSubChecklist,
  getAllConstructionSubChecklists,
  getConstructionSubChecklistById,
  updateConstructionSubChecklist,
  deleteConstructionSubChecklist,
} = require("../controllers/construction-sub-checklist.controller");
const {
  createConstructionSubChecklistValidation,
  updateConstructionSubChecklistValidation,
  getConstructionSubChecklistByIdValidation,
  queryValidation,
} = require("../validations/construction-sub-checklist.validation");
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
  validateRequest(createConstructionSubChecklistValidation, REQUEST_SOURCE.BODY),
  createConstructionSubChecklist
);

router.get(
  "/",
  validateRequest(queryValidation, REQUEST_SOURCE.QUERY),
  getAllConstructionSubChecklists
);

router.get(
  "/:construction_sub_checklist_id",
  validateRequest(getConstructionSubChecklistByIdValidation, REQUEST_SOURCE.PARAMS),
  getConstructionSubChecklistById
);

router.put(
  "/:construction_sub_checklist_id",
  validateRequest(getConstructionSubChecklistByIdValidation, REQUEST_SOURCE.PARAMS),
  validateRequest(updateConstructionSubChecklistValidation, REQUEST_SOURCE.BODY),
  updateConstructionSubChecklist
);

router.delete(
  "/:construction_sub_checklist_id",
  validateRequest(getConstructionSubChecklistByIdValidation, REQUEST_SOURCE.PARAMS),
  deleteConstructionSubChecklist
);

module.exports = router;