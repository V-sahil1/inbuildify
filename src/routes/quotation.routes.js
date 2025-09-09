const express = require("express");
const router = express.Router();
const { createQuotation, createQuotationVersion, getQuotationById, getQuotations } = require("../controllers/quotation.controller");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const { validateRequest } = require("../middleware/validateRequestMiddleware");
const { createQuotationSchema, getQuotationSchema, getQuotationsSchema, createQuotationVersionSchema } = require("../validations/quotation.validation");
const { REQUEST_SOURCE } = require("../config/constants");

router.use(authMiddleware);
router.use(roleMiddleware);

router.post("/", validateRequest(createQuotationSchema, REQUEST_SOURCE.BODY), createQuotation);
router.post("/:quotation_id/version", validateRequest(createQuotationVersionSchema, REQUEST_SOURCE.BODY), createQuotationVersion);
router.get("/", validateRequest(getQuotationsSchema, REQUEST_SOURCE.QUERY), getQuotations);
router.get("/:quotation_id", validateRequest(getQuotationSchema, REQUEST_SOURCE.PARAMS), getQuotationById);

module.exports = router;
