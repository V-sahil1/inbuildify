const express = require("express");
const router = express.Router();

const {
  createSalesStage,
  getAllSalesStages,
  deleteSalesStage,
  updateSalesStage,
} = require("../controllers/sales-stage.controller");
const {
  createSalesStageSchema,
  getAllSalesStageSchema,
  deleteSalesStageSchema,
  updateSalesStageIdParamsSchema,
  updateSalesStageSchema,
} = require("../validations/sales-stage.validation");

const { validateRequest } = require("../middleware/validateRequestMiddleware");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const { REQUEST_SOURCE } = require("../config/constants");

router.use(authMiddleware);
router.use(roleMiddleware);

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
module.exports = router;
