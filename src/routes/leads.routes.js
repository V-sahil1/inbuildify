const express = require("express");
const router = express.Router();
const { createLead, getLeads, getLeadById, updateLead, updateAssignee, convertLead, deleteLead } = require("../controllers/leads.controller");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const { validateRequest } = require("../middleware/validateRequestMiddleware");
const { createLeadSchema, getLeadByIdSchema, updateLeadSchema, updateAssigneeSchema, convertLeadSchema } = require("../validations/leads.validation");
const { REQUEST_SOURCE } = require("../config/constants");

router.use(authMiddleware);
router.use(roleMiddleware);

router.post("/", validateRequest(createLeadSchema, REQUEST_SOURCE.BODY), createLead);
router.get("/", getLeads);
router.get("/:lead_id", validateRequest(getLeadByIdSchema, REQUEST_SOURCE.PARAMS), getLeadById);
router.put("/:lead_id", validateRequest(updateLeadSchema.params, REQUEST_SOURCE.PARAMS), validateRequest(updateLeadSchema.body, REQUEST_SOURCE.BODY), updateLead);
router.put("/transfer/:lead_id", validateRequest(updateAssigneeSchema.params, REQUEST_SOURCE.PARAMS), validateRequest(updateAssigneeSchema.body, REQUEST_SOURCE.BODY), updateAssignee);
router.put("/convert/:lead_id", validateRequest(convertLeadSchema.params, REQUEST_SOURCE.PARAMS), convertLead);
router.delete("/:lead_id", validateRequest(convertLeadSchema.params, REQUEST_SOURCE.PARAMS), deleteLead);

module.exports = router;
