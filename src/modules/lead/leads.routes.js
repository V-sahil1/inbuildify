import express from "express";

const router = express.Router();

import {
  createLead,
  getAllLeads,
  getLeadById,
  updateLead,
  deleteLead,
  getLeadStats,
  getSalesDashboard,
  updateLeadStatus,
  assignLead,
  forceCreateLead,
  convertLeadToOpportunity,
  removeHLPackage,
  getAllLeadActions,
  getLeadActivityLog,
  createPublicLead,
  getLeadDocuments,
} from "./leads.controller.js";
import authMiddleware from "../../middleware/authMiddleware.js";
import roleMiddleware from "../../middleware/roleMiddleware.js";
import camelToSnakeMiddleware from "../../middleware/caseConverterMiddleware.js";
import { validateRequest } from "../../middleware/validateRequestMiddleware.js";
import {
  createLeadSchema,
  getLeadByIdSchema,
  updateLeadSchema,
  updateLeadStatusSchema,
  assignLeadSchema,
  getAllLeadsQuerySchema,
  convertLeadToOpportunitySchema,
  removeHLPackageSchema,
  getLeadActivityLogQuerySchema,
  createPublicLeadSchema,
} from "./leads.validation.js";
import { validateExternalToken } from "../../middleware/externalAuthMiddleware.js";
import { REQUEST_SOURCE } from "../../config/constants.js";

// Public route - Protected by Landing Page auth token validation
router.post(
  "/public/create",
  validateExternalToken("landing"),
  camelToSnakeMiddleware,
  validateRequest(createPublicLeadSchema, REQUEST_SOURCE.BODY),
  createPublicLead,
);

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

// Get sales dashboard aggregated data
router.get("/sales-dashboard", getSalesDashboard);

// Get lead activity log
router.get(
  "/:leads_id/activity-log",
  validateRequest(getLeadByIdSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(getLeadActivityLogQuerySchema, REQUEST_SOURCE.QUERY),
  getLeadActivityLog,
);

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
router.put(
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
router.delete(
  "/:leads_id/hl-package",
  validateRequest(getLeadByIdSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(removeHLPackageSchema, REQUEST_SOURCE.BODY),
  removeHLPackage,
);

router.get(
  "/activity-log/:leads_id",
  validateRequest(getLeadByIdSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(getLeadActivityLogQuerySchema, REQUEST_SOURCE.QUERY),
  getLeadActivityLog,
);

// Get all lead actions (notes, tasks, appointments, sms)
router.get(
  "/:leads_id/actions",
  validateRequest(getLeadByIdSchema, REQUEST_SOURCE.PARAMS),
  getAllLeadActions,
);

// Get all documents for a lead, grouped into a folder hierarchy
router.get(
  "/:leads_id/documents",
  validateRequest(getLeadByIdSchema, REQUEST_SOURCE.PARAMS),
  getLeadDocuments,
);

export default router;
