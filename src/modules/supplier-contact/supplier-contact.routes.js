const express = require("express");
const router = express.Router();

const {
  createSupplierContact,
  getAllSupplierContacts,
  deleteSupplierContact,
  updateSupplierContact,
} = require("./supplier-contact.controller.js");
const {
  createSupplierContactSchema,
  getAllSupplierContactsSchema,
  deleteSupplierContactSchema,
  updateSupplierContactParamsSchema,
  updateSupplierContactSchema,
} = require("./supplier-contact.validation.js");
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
