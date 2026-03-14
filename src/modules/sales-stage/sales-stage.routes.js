const express = require("express");
const router = express.Router();

const {
  createSalesStage,
  getAllSalesStages,
  getSalesStagesBySalesProcessId,
  deleteSalesStage,
  updateSalesStage,
  updateSalesStageIsActive,
} = require("./sales-stage.controller.js");
const {
  createSalesStageSchema,
  getSalesStageBySalesProcessIdSchema,
  deleteSalesStageSchema,
  updateSalesStageIdParamsSchema,
  updateSalesStageSchema,
  updateSalesStageIsActiveSchema,
} = require("./sales-stage.validation.js");

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
  validateRequest(createSalesStageSchema, REQUEST_SOURCE.BODY),
  createSalesStage,
);

router.get("/", getAllSalesStages);

router.get(
  "/process",
  validateRequest(getSalesStageBySalesProcessIdSchema, REQUEST_SOURCE.QUERY),
  getSalesStagesBySalesProcessId,
);
router.delete(
  "/:sales_stage_id",
  validateRequest(deleteSalesStageSchema, REQUEST_SOURCE.PARAMS),
  deleteSalesStage,
);

router.put(
  "/:sales_stage_id",
  validateRequest(updateSalesStageIdParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateSalesStageSchema, REQUEST_SOURCE.BODY),
  updateSalesStage,
);

router.put(
  "/is-active/:sales_stage_id",
  validateRequest(updateSalesStageIdParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateSalesStageIsActiveSchema, REQUEST_SOURCE.BODY),
  updateSalesStageIsActive,
);
module.exports = router;
