const express = require("express");
const router = express.Router();

const {
  createSalesStage,
  getAllSalesStages,
  getSalesStagesBySalesProcessId,
  deleteSalesStage,
  updateSalesStage,
  updateSalesStageIsActive,
} = require("../controllers/sales-stage.controller");
const {
  createSalesStageSchema,
  getAllSalesStageSchema,
  getSalesStageBySalesProcessIdSchema,
  deleteSalesStageSchema,
  updateSalesStageIdParamsSchema,
  updateSalesStageSchema,
  updateSalesStageIsActiveSchema,
} = require("../validations/sales-stage.validation");

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
  validateRequest(createSalesStageSchema, REQUEST_SOURCE.BODY),
  createSalesStage
);

router.get(
  "/",
  validateRequest(getAllSalesStageSchema, REQUEST_SOURCE.QUERY),
  getAllSalesStages
);

router.get(
  "/process",
  validateRequest(getSalesStageBySalesProcessIdSchema, REQUEST_SOURCE.QUERY),
  getSalesStagesBySalesProcessId
);
router.delete(
  "/:sales_stage_id",
  validateRequest(deleteSalesStageSchema, REQUEST_SOURCE.PARAMS),
  deleteSalesStage
);

router.put(
  "/:sales_stage_id",
  validateRequest(updateSalesStageIdParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateSalesStageSchema, REQUEST_SOURCE.BODY),
  updateSalesStage
);

router.put(
  "/is-active/:sales_stage_id",
  validateRequest(updateSalesStageIdParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateSalesStageIsActiveSchema, REQUEST_SOURCE.BODY),
  updateSalesStageIsActive
);
module.exports = router;
