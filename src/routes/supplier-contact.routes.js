const express = require("express");
const router = express.Router();

const {
  createSupplierContact,
  getAllSupplierContacts,
  deleteSupplierContact,
  updateSupplierContact,
} = require("../controllers/supplier-contact.controller");
const {
  createSupplierContactSchema,
  getAllSupplierContactsSchema,
  deleteSupplierContactSchema,
  updateSupplierContactParamsSchema,
  updateSupplierContactSchema,
} = require("../validations/supplier-contact.validation");
const { validateRequest } = require("../middleware/validateRequestMiddleware");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

const { REQUEST_SOURCE } = require("../config/constants");

router.use(authMiddleware);
router.use(roleMiddleware);

router.post(
  "/",
  validateRequest(createSupplierContactSchema, REQUEST_SOURCE.BODY),
  createSupplierContact
);

router.get(
  "/",
  validateRequest(getAllSupplierContactsSchema, REQUEST_SOURCE.QUERY),
  getAllSupplierContacts
);

router.delete(
  "/:supplier_contact_id",
  validateRequest(deleteSupplierContactSchema, REQUEST_SOURCE.PARAMS),
  deleteSupplierContact
);

router.put(
  "/:supplier_contact_id",
  validateRequest(updateSupplierContactParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateSupplierContactSchema, REQUEST_SOURCE.BODY),
  updateSupplierContact
);

module.exports = router;
