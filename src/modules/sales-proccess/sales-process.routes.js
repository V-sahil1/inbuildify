const express = require("express");
const router = express.Router();

const {
  createSalesProcess,
  getAllSalesProcess,
  deleteSalesProcess,
  updateSalesProcess,
} = require("./sales-process.controller.js");
const {
  createSalesProccessSchema,
  deleteSalesProcessSchema,
  updateSalesProcessIdParamsSchema,
  updateSalesProcessSchema,
} = require("./sales-process.validation.js");

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
  validateRequest(createSalesProccessSchema, REQUEST_SOURCE.BODY),
  createSalesProcess,
);

router.get("/", getAllSalesProcess);

router.delete(
  "/:id",
  validateRequest(deleteSalesProcessSchema, REQUEST_SOURCE.PARAMS),
  deleteSalesProcess,
);

router.put(
  "/:id",
  validateRequest(updateSalesProcessIdParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateSalesProcessSchema, REQUEST_SOURCE.BODY),
  updateSalesProcess,
);
module.exports = router;
