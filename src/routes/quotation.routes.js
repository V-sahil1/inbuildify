const express = require("express");
const router = express.Router();
const { createQuotation, createQuotationVersion, getQuotationById, getQuotationVersionById, getQuotations, deleteQuotations } = require("../controllers/quotation.controller");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const { validateRequest } = require("../middleware/validateRequestMiddleware");
const { createQuotationSchema, getQuotationSchema, getQuotationVersionSchema, getQuotationsSchema, createQuotationVersionSchema, deleteQuotationsSchema } = require("../validations/quotation.validation");
const { REQUEST_SOURCE } = require("../config/constants");

router.use(authMiddleware);
router.use(roleMiddleware);

router.post("/", validateRequest(createQuotationSchema, REQUEST_SOURCE.BODY), createQuotation);
router.post("/:quotation_id/version", validateRequest(createQuotationVersionSchema, REQUEST_SOURCE.BODY), createQuotationVersion);
router.get("/:quotation_id", validateRequest(getQuotationSchema, REQUEST_SOURCE.PARAMS), getQuotationById);
router.get("/version/:quotation_version_id", validateRequest(getQuotationVersionSchema, REQUEST_SOURCE.PARAMS), getQuotationVersionById);
router.get("/", validateRequest(getQuotationsSchema, REQUEST_SOURCE.QUERY), getQuotations);
router.delete("/:quotation_id", validateRequest(deleteQuotationsSchema, REQUEST_SOURCE.PARAMS), deleteQuotations);

module.exports = router;
