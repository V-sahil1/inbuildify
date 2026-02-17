const express = require("express");
const router = express.Router();

const {
  createBusinessContact,
  getAllBusinessContacts,
  getBusinessContactById,
  updateBusinessContact,
  deleteBusinessContact,
} = require("../controllers/business-contact.controller");

const {
  createBusinessContactSchema,
  getAllBusinessContactsSchema,
  getBusinessContactByIdSchema,
  updateBusinessContactSchema,
  deleteBusinessContactSchema,
} = require("../validations/business-contact.validation");

const { validateRequest } = require("../middleware/validateRequestMiddleware");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const camelToSnakeMiddleware = require("../middleware/caseConverterMiddleware.js");
const { REQUEST_SOURCE } = require("../config/constants");

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
