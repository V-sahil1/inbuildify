const express = require("express");
const router = express.Router();
const { createInvoice, getInvoices } = require("../controllers/invoice.controller");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const { validateRequest } = require("../middleware/validateRequestMiddleware");
const { createInvoiceSchema, getInvoicesSchema } = require("../validations/invoice.validation");
const { REQUEST_SOURCE } = require("../config/constants");

router.use(authMiddleware);
router.use(roleMiddleware);

router.post("/:lead_id", validateRequest(createInvoiceSchema, REQUEST_SOURCE.BODY), createInvoice);
router.get("/:lead_id", validateRequest(getInvoicesSchema, REQUEST_SOURCE.QUERY), getInvoices);

module.exports = router;
