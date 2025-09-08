const express = require("express");
const router = express.Router({ mergeParams: true });
const {
  createLeadContact,
  updateLeadContact,
  getLeadContacts,
  getLeadContactById
} = require("../controllers/leadsContact.controller.js");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const { validateRequest } = require("../middleware/validateRequestMiddleware");
const { createLeadContactSchema, updateLeadContactSchema } = require("../validations/leads-contact.validation.js");
const { REQUEST_SOURCE } = require("../config/constants");

router.use(authMiddleware);
router.use(roleMiddleware);

router.post("/:lead_id", validateRequest(createLeadContactSchema.params, REQUEST_SOURCE.PARAMS), validateRequest(createLeadContactSchema.body, REQUEST_SOURCE.BODY), createLeadContact);
router.put("/:lead_contact_id", validateRequest(updateLeadContactSchema.params, REQUEST_SOURCE.PARAMS), validateRequest(updateLeadContactSchema.body, REQUEST_SOURCE.BODY), updateLeadContact);
router.get("/lead/:lead_id", getLeadContacts);
router.get("/:lead_contact_id", getLeadContactById);

module.exports = router;
