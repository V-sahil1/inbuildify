const express = require("express");
const router = express.Router();
const {
    createCustomer,
    getCustomers,
    getCustomerById,
    updateCustomer,
    deleteCustomer
} = require("../controllers/customer.controller");
const {validateRequest} = require("../middleware/validateRequestMiddleware");

const {
    createCustomerSchema,
    getCustomerByIdSchema,
    updateCustomerParamsSchema,
    updateCustomerSchema,
    deleteCustomerSchema
} = require("../validations/customer.validation");
const authMiddleware = require("../middleware/authMiddleware.js");
const roleMiddleware = require("../middleware/roleMiddleware.js");
const {REQUEST_SOURCE} = require("../config/constants");

router.use(authMiddleware);
router.use(roleMiddleware);

router.post("/", validateRequest(createCustomerSchema), createCustomer); // Create a new customer
router.get("/", getCustomers) // Get all customers
router.get("/:id",
    validateRequest(getCustomerByIdSchema, REQUEST_SOURCE.PARAMS),
    getCustomerById) // Get a customer by ID
router.put("/:id",
    validateRequest(updateCustomerParamsSchema, REQUEST_SOURCE.PARAMS),
    validateRequest(updateCustomerSchema),
    updateCustomer) // Update a customer by ID
router.delete("/:id",
    validateRequest(deleteCustomerSchema, REQUEST_SOURCE.PARAMS),
    deleteCustomer) // Delete a customer by ID

module.exports = router;