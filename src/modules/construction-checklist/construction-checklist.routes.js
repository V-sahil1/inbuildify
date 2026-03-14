const express = require("express");
const router = express.Router();
const {
  createConstructionChecklist,
  getAllConstructionChecklists,
  getConstructionChecklistById,
  updateConstructionChecklist,
  deleteConstructionChecklist,
} = require("./construction-checklist.controller.js");
const {
  createConstructionChecklistValidation,
  updateConstructionChecklistValidation,
  getConstructionChecklistByIdValidation,
  queryValidation,
} = require("./construction-checklist.validation.js");
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