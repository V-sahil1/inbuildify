// const express = require("express");
// const router = express.Router();

// const authMiddleware = require("../middleware/authMiddleware");
// const roleMiddleware = require("../middleware/roleMiddleware");
// const camelToSnakeMiddleware = require("../middleware/caseConverterMiddleware.js");

// const { validateRequest } = require("../middleware/validateRequestMiddleware");
// const { REQUEST_SOURCE } = require("../config/constants");
// const { createQuotationSchema, deleteQuotationSchema, updateQuotationVersionParamsSchema, updateQuotationVersionBodySchema, duplicateQuotationVersionSchema, compareQuotationVersionsParamsSchema, compareQuotationVersionsQuerySchema, removePackageFromVersionSchema } = require("../validations/quotation.validation");
// const quotationController = require("../controllers/quotation.controller");

// router.use(authMiddleware);
// router.use(roleMiddleware);

// router.post(
//   "/:leads_id",
//   validateRequest(createQuotationSchema, REQUEST_SOURCE.PARAMS),
//   camelToSnakeMiddleware,                                            
//   quotationController.createQuotation
// );

// router.get(
//   "/:leads_id",
//   validateRequest(createQuotationSchema, REQUEST_SOURCE.PARAMS),
//   quotationController.getQuotationsByLeadId
// );

// router.get(
//   "/version/:quotation_id",
//   validateRequest(deleteQuotationSchema, REQUEST_SOURCE.PARAMS),
//   quotationController.getQuotationVersions
// );

// router.delete(
//   "/:quotation_id",
//   validateRequest(deleteQuotationSchema, REQUEST_SOURCE.PARAMS),
//   quotationController.deleteQuotation
// );

// router.put(
//   "/version/:quotation_version_id",
//   camelToSnakeMiddleware,
//   validateRequest(updateQuotationVersionParamsSchema, REQUEST_SOURCE.PARAMS),
//   validateRequest(updateQuotationVersionBodySchema, REQUEST_SOURCE.BODY),
//   quotationController.updateQuotationVersion
// );

// router.post(
//   "/version/:quotation_version_id/duplicate",
//   validateRequest(duplicateQuotationVersionSchema, REQUEST_SOURCE.PARAMS),
//   camelToSnakeMiddleware,
//   quotationController.duplicateQuotationVersion
// );

// router.get(
//   "/compare/:quotation_id",
//   validateRequest(compareQuotationVersionsParamsSchema, REQUEST_SOURCE.PARAMS),
//   validateRequest(compareQuotationVersionsQuerySchema, REQUEST_SOURCE.QUERY),
//   quotationController.compareQuotationVersions
// );

// router.delete(
//   "/version/:quotation_version_id/packages/:package_id",
//   validateRequest(removePackageFromVersionSchema, REQUEST_SOURCE.PARAMS),
//   camelToSnakeMiddleware,
//   quotationController.removePackageFromVersion
// );

// module.exports = router;
