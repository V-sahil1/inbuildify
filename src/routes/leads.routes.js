const express = require("express");
const router = express.Router();
const { createLead, getLeads, getLeadById, updateLead } = require("../controllers/leads.controller");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const { validateRequest } = require("../middleware/validateRequestMiddleware");
const { createLeadSchema, getLeadByIdSchema, updateLeadSchema } = require("../validations/leads.validation");
const { REQUEST_SOURCE } = require("../config/constants");

router.post("/", validateRequest(createLeadSchema), createLead);
router.get("/", authMiddleware, roleMiddleware, getLeads);
router.get("/:id", validateRequest(getLeadByIdSchema, REQUEST_SOURCE.PARAMS), authMiddleware, roleMiddleware, getLeadById);
router.post("/:lead_id", validateRequest(updateLeadSchema.params, REQUEST_SOURCE.PARAMS), validateRequest(updateLeadSchema.body, REQUEST_SOURCE.BODY), authMiddleware, roleMiddleware, updateLead);

module.exports = router;
