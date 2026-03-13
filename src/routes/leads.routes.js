const express = require("express");
const router = express.Router();
const {
  createLead,
  getAllLeads,
  getLeadById,
  updateLead,
  deleteLead,
  getLeadStats,
  updateLeadStatus,
  assignLead,
  forceCreateLead,
  convertLeadToOpportunity,
  removeHLPackage,
} = require("../controllers/leads.controller");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const camelToSnakeMiddleware = require("../middleware/caseConverterMiddleware.js");
const { validateRequest } = require("../middleware/validateRequestMiddleware");
const {
  createLeadSchema,
  getLeadByIdSchema,
  updateLeadSchema,
  updateLeadStatusSchema,
  assignLeadSchema,
  getAllLeadsQuerySchema,
  convertLeadToOpportunitySchema,
  removeHLPackageSchema,
} = require("../validations/leads.validation");
const { REQUEST_SOURCE } = require("../config/constants");

router.use(authMiddleware);
router.use(roleMiddleware);
router.use(camelToSnakeMiddleware);



router.post(
  "/",
  validateRequest(createLeadSchema, REQUEST_SOURCE.BODY),
  createLead,
);

// Force create a new lead (skip email duplicate check)
router.post(
  "/force",
  validateRequest(createLeadSchema, REQUEST_SOURCE.BODY),
  forceCreateLead,
);

// Get all leads with filtering and pagination
router.get(
  "/",
  validateRequest(getAllLeadsQuerySchema, REQUEST_SOURCE.QUERY),
  getAllLeads,
);

// Get lead statistics
router.get("/stats", getLeadStats);

// Get lead by ID
router.get(
  "/:leads_id",
  validateRequest(getLeadByIdSchema, REQUEST_SOURCE.PARAMS),
  getLeadById,
);

// Update lead
router.put(
  "/:leads_id",
  validateRequest(getLeadByIdSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateLeadSchema, REQUEST_SOURCE.BODY),
  updateLead,
);

// Update lead status
router.patch(
  "/:leads_id/status",
  validateRequest(getLeadByIdSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateLeadStatusSchema, REQUEST_SOURCE.BODY),
  updateLeadStatus,
);

// Assign lead to user
router.patch(
  "/:leads_id/assign",
  validateRequest(getLeadByIdSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(assignLeadSchema, REQUEST_SOURCE.BODY),
  assignLead,
);

// Delete lead
router.delete(
  "/:leads_id",
  validateRequest(getLeadByIdSchema, REQUEST_SOURCE.PARAMS),
  deleteLead,
);

// Convert lead to opportunity
router.post(
  "/:leads_id/convert",
  validateRequest(getLeadByIdSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(convertLeadToOpportunitySchema, REQUEST_SOURCE.BODY),
  convertLeadToOpportunity,
);

// Remove HLP from lead
router.delete(
  "/:leads_id/hl-package",
  validateRequest(getLeadByIdSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(removeHLPackageSchema, REQUEST_SOURCE.BODY),
  removeHLPackage,
);

module.exports = router;
