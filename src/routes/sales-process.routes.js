const express = require("express");
const router = express.Router();

const {
  createSalesProcess,
  getAllSalesProcess,
  deleteSalesProcess,
  updateSalesProcess,
} = require("../controllers/sales-process.controller");
const {
  createSalesProccessSchema,
  deleteSalesProcessSchema,
  updateSalesProcessIdParamsSchema,
  updateSalesProcessSchema,
} = require("../validations/sales-process.validation");

const { validateRequest } = require("../middleware/validateRequestMiddleware");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const camelToSnakeMiddleware = require("../middleware/caseConverterMiddleware.js");

const { REQUEST_SOURCE } = require("../config/constants");

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
