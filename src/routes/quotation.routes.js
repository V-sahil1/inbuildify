const express = require("express");
const router = express.Router();
const { createQuotation, getQuotationById } = require("../controllers/quotation.controller");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const { validateRequest } = require("../middleware/validateRequestMiddleware");
const { createQuotationSchema, getQuotationSchema } = require("../validations/quotation.validation");
const { REQUEST_SOURCE } = require("../config/constants");

router.use(authMiddleware);
router.use(roleMiddleware);

router.post("/", validateRequest(createQuotationSchema, REQUEST_SOURCE.BODY), createQuotation);
router.get("/:quotation_id", validateRequest(getQuotationSchema, REQUEST_SOURCE.PARAMS), getQuotationById);

module.exports = router;
