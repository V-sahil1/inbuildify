const express = require("express");
const router = express.Router();

const {
  createJobCommission,
  getAllJobCommissions,
  deleteJobCommission,
  updateJobCommission,
} = require("../controllers/job-commission.controller");
const {
  createJobCommissionSchema,
  getAllJobCommissionsSchema,
  deleteJobCommissionSchema,
  updateJobCommissionParamsSchema,
  updateJobCommissionSchema,
} = require("../validations/job-commission.validation");
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
  validateRequest(createJobCommissionSchema, REQUEST_SOURCE.BODY),
  createJobCommission
);

router.get(
  "/",
  validateRequest(getAllJobCommissionsSchema, REQUEST_SOURCE.QUERY),
  getAllJobCommissions
);

router.delete(
  "/:job_commission_id",
  validateRequest(deleteJobCommissionSchema, REQUEST_SOURCE.PARAMS),
  deleteJobCommission
);

router.put(
  "/:job_commission_id",
  validateRequest(updateJobCommissionParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateJobCommissionSchema, REQUEST_SOURCE.BODY),
  updateJobCommission
);

module.exports = router;
