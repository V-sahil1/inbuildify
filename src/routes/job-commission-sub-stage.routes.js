const express = require("express");
const router = express.Router();

const {
  createJobCommissionSubStage,
  getAllJobCommissionSubStages,
  getJobCommissionSubStagesByCommissionId,
  deleteJobCommissionSubStage,
  updateJobCommissionSubStage,
} = require("../controllers/job-commission-sub-stage.controller");
const {
  createJobCommissionSubStageSchema,
  getAllJobCommissionSubStageSchema,
  getJobCommissionSubStagesByCommissionIdSchema,
  getJobCommissionSubStagesByCommissionSchema,
  deleteJobCommissionSubStageSchema,
  updateJobCommissionSubStageParamsSchema,
  updateJobCommissionSubStageSchema,
} = require("../validations/job-commission-sub-stage.validation");

const { validateRequest } = require("../middleware/validateRequestMiddleware");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

const { REQUEST_SOURCE } = require("../config/constants");

router.use(authMiddleware);
router.use(roleMiddleware);

router.post(
  "/",
  validateRequest(createJobCommissionSubStageSchema, REQUEST_SOURCE.BODY),
  createJobCommissionSubStage
);

router.get(
  "/",
  validateRequest(getAllJobCommissionSubStageSchema, REQUEST_SOURCE.QUERY),
  getAllJobCommissionSubStages
);

router.get(
  "/:job_commission_id",
  validateRequest(
    getJobCommissionSubStagesByCommissionIdSchema,
    REQUEST_SOURCE.PARAMS
  ),
  validateRequest(
    getJobCommissionSubStagesByCommissionSchema,
    REQUEST_SOURCE.QUERY
  ),
  getJobCommissionSubStagesByCommissionId
);

router.delete(
  "/:id",
  validateRequest(deleteJobCommissionSubStageSchema, REQUEST_SOURCE.PARAMS),
  deleteJobCommissionSubStage
);

router.put(
  "/:job_commission_sub_stage_id",
  validateRequest(
    updateJobCommissionSubStageParamsSchema,
    REQUEST_SOURCE.PARAMS
  ),
  validateRequest(updateJobCommissionSubStageSchema, REQUEST_SOURCE.BODY),
  updateJobCommissionSubStage
);
module.exports = router;
