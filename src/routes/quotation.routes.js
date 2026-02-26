const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const camelToSnakeMiddleware = require("../middleware/caseConverterMiddleware.js");

const { validateRequest } = require("../middleware/validateRequestMiddleware");
const { REQUEST_SOURCE } = require("../config/constants");
const { createQuotationSchema, deleteQuotationSchema, updateQuotationVersionParamsSchema, updateQuotationVersionBodySchema } = require("../validations/quotation.validation");
const quotationController = require("../controllers/quotation.controller");

router.use(authMiddleware);
router.use(roleMiddleware);

router.post(
  "/:leads_id",
  validateRequest(createQuotationSchema, REQUEST_SOURCE.PARAMS),
  camelToSnakeMiddleware,
  quotationController.createQuotation
);

router.get(
  "/:leads_id",
  validateRequest(createQuotationSchema, REQUEST_SOURCE.PARAMS),
  quotationController.getQuotationsByLeadId
);

router.get(
  "/versions/:quotation_id",
  validateRequest(deleteQuotationSchema, REQUEST_SOURCE.PARAMS),
  quotationController.getQuotationVersions
);

router.delete(
  "/:quotation_id",
  validateRequest(deleteQuotationSchema, REQUEST_SOURCE.PARAMS),
  quotationController.deleteQuotation
);

router.put(
  "/version/:quotation_version_id",
  camelToSnakeMiddleware,
  validateRequest(updateQuotationVersionParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateQuotationVersionBodySchema, REQUEST_SOURCE.BODY),
  quotationController.updateQuotationVersion
);

module.exports = router;
