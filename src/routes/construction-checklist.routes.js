const express = require("express");
const router = express.Router();
const {
  createConstructionChecklist,
  getAllConstructionChecklists,
  getConstructionChecklistById,
  updateConstructionChecklist,
  deleteConstructionChecklist,
} = require("../controllers/construction-checklist.controller");
const {
  createConstructionChecklistValidation,
  updateConstructionChecklistValidation,
  getConstructionChecklistByIdValidation,
  queryValidation,
} = require("../validations/construction-checklist.validation");
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
  validateRequest(createConstructionChecklistValidation, REQUEST_SOURCE.BODY),
  createConstructionChecklist
);

router.get(
  "/",
  validateRequest(queryValidation, REQUEST_SOURCE.QUERY),
  getAllConstructionChecklists
);

router.get(
  "/:construction_checklist_id",
  validateRequest(getConstructionChecklistByIdValidation, REQUEST_SOURCE.PARAMS),
  getConstructionChecklistById
);

router.put(
  "/:construction_checklist_id",
  validateRequest(getConstructionChecklistByIdValidation, REQUEST_SOURCE.PARAMS),
  validateRequest(updateConstructionChecklistValidation, REQUEST_SOURCE.BODY),
  updateConstructionChecklist
);

router.delete(
  "/:construction_checklist_id",
  validateRequest(getConstructionChecklistByIdValidation, REQUEST_SOURCE.PARAMS),
  deleteConstructionChecklist
);

module.exports = router;