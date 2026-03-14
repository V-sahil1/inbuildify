const express = require("express");
const router = express.Router();

const {
  createBusinessContact,
  getAllBusinessContacts,
  getBusinessContactById,
  getBusinessContactsByLeadsId,
  updateBusinessContact,
  deleteBusinessContact,
} = require("./business-contact.controller.js");

const {
  createBusinessContactSchema,
  getAllBusinessContactsSchema,
  getBusinessContactByIdSchema,
  getBusinessContactsByLeadsIdSchema,
  updateBusinessContactSchema,
  deleteBusinessContactSchema,
} = require("./business-contact.validation.js");

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
  validateRequest(createBusinessContactSchema, REQUEST_SOURCE.BODY),
  createBusinessContact,
);

router.get(
  "/",
  validateRequest(getAllBusinessContactsSchema, REQUEST_SOURCE.QUERY),
  getAllBusinessContacts,
);

router.get(
  "/:business_contact_id",
  validateRequest(getBusinessContactByIdSchema, REQUEST_SOURCE.PARAMS),
  getBusinessContactById,
);

router.get(
  "/lead/:leads_id",
  validateRequest(getBusinessContactsByLeadsIdSchema, REQUEST_SOURCE.PARAMS),
  getBusinessContactsByLeadsId,
);

router.put(
  "/:business_contact_id",
  validateRequest(updateBusinessContactSchema, REQUEST_SOURCE.BODY),
  updateBusinessContact,
);

router.delete(
  "/:business_contact_id",
  validateRequest(deleteBusinessContactSchema, REQUEST_SOURCE.PARAMS),
  deleteBusinessContact,
);

module.exports = router;
