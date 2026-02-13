const express = require("express");
const router = express.Router();

const contactController = require("../controllers/contact.controller");

const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const camelToSnakeMiddleware = require("../middleware/caseConverterMiddleware");
const { validateRequest } = require("../middleware/validateRequestMiddleware");
const { REQUEST_SOURCE } = require("../config/constants");

const {
  createContactSchema,
  updateContactSchema,
  convertContactSchema,
  getContactsSchema,
} = require("../validations/contact.validation");

/* ============================================================
    CONTACT ROUTES
============================================================ */

/**
 * GET /contacts
 * List all contacts for the builder
 */
router.get(
  "/",
  camelToSnakeMiddleware,
  authMiddleware,
  roleMiddleware,
  validateRequest(getContactsSchema, REQUEST_SOURCE.QUERY),
  contactController.getContacts,
);

/**
 * GET /contacts/:contactId
 * View a single contact
 */
router.get(
  "/:contact_id",
  camelToSnakeMiddleware,
  authMiddleware,
  roleMiddleware,
  contactController.getContactById,
);

/**
 * POST /contacts
 * Create new contact
 */
router.post(
  "/",
  camelToSnakeMiddleware,
  authMiddleware,
  roleMiddleware,
  validateRequest(createContactSchema, REQUEST_SOURCE.BODY),
  contactController.createContact,
);

/**
 * PUT /contacts/:contactId
 * Update contact
 */
router.put(
  "/:contact_id",
  camelToSnakeMiddleware,
  authMiddleware,
  roleMiddleware,
  validateRequest(updateContactSchema, REQUEST_SOURCE.BODY),
  contactController.updateContact,
);

/**
 * DELETE /contacts/:contactId
 * Soft delete contact
 */
router.delete(
  "/:contact_id",
  camelToSnakeMiddleware,
  authMiddleware,
  roleMiddleware,
  contactController.deleteContact,
);

/**
 * POST /contacts/:contactId/convert-to-user
 * Convert contact → full user with login credentials
 */
router.post(
  "/:contact_id/convert-to-user",
  camelToSnakeMiddleware,
  authMiddleware,
  roleMiddleware,
  validateRequest(convertContactSchema, REQUEST_SOURCE.BODY),
  contactController.convertContactToUser,
);

module.exports = router;
