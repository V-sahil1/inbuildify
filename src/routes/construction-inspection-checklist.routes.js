const express = require("express");
const router = express.Router();

const {
  createConstructionInspectionChecklist,
  getConstructionInspectionChecklists,
  updateConstructionInspectionChecklist,
  deleteConstructionInspectionChecklist,
  getConstructionInspectionChecklistById,
} = require("../controllers/construction-inspection-checklist.controller");

const {
  createConstructionInspectionChecklistSchema,
  getConstructionInspectionChecklistsSchema,
  updateConstructionInspectionChecklistSchema,
  deleteConstructionInspectionChecklistSchema,
  updateExistingJobsSchema,
} = require("../validations/construction-inspection-checklist.validation");

const { validateRequest } = require("../middleware/validateRequestMiddleware");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const caseConverterMiddleware = require("../middleware/caseConverterMiddleware");
const { REQUEST_SOURCE } = require("../config/constants");

router.use(authMiddleware);
router.use(roleMiddleware);
router.use(caseConverterMiddleware);
router.post(
  "/",
  validateRequest(
    createConstructionInspectionChecklistSchema,
    REQUEST_SOURCE.BODY
  ),
  createConstructionInspectionChecklist
);

router.get(
  "/",
  validateRequest(
    getConstructionInspectionChecklistsSchema,
    REQUEST_SOURCE.QUERY
  ),
  getConstructionInspectionChecklists
);

router.get(
  "/:id",
  validateRequest(
    deleteConstructionInspectionChecklistSchema,
    REQUEST_SOURCE.PARAMS
  ),
  getConstructionInspectionChecklistById
);

router.put(
  "/:id",
  validateRequest(
    deleteConstructionInspectionChecklistSchema,
    REQUEST_SOURCE.PARAMS
  ),
  validateRequest(
    updateConstructionInspectionChecklistSchema,
    REQUEST_SOURCE.BODY
  ),
  updateConstructionInspectionChecklist
);

router.delete(
  "/:id",
  validateRequest(updateExistingJobsSchema, REQUEST_SOURCE.BODY),
  validateRequest(
    deleteConstructionInspectionChecklistSchema,
    REQUEST_SOURCE.PARAMS
  ),
  deleteConstructionInspectionChecklist
);

module.exports = router;
