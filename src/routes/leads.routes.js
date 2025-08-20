const express = require("express");
const router = express.Router();
const { createLead, getLeads, getLeadById } = require("../controllers/leads.controller");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const { validateRequest } = require("../middleware/validateRequestMiddleware");
const { createLeadSchema, getLeadByIdSchema } = require("../validations/leads.validation");
const { REQUEST_SOURCE } = require("../config/constants");

router.post("/", validateRequest(createLeadSchema), createLead);
router.get("/", authMiddleware, roleMiddleware, getLeads);
router.get("/:id", validateRequest(getLeadByIdSchema, REQUEST_SOURCE.PARAMS), authMiddleware, roleMiddleware, getLeadById);

module.exports = router;
