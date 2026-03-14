const express = require("express");
const router = express.Router();

const {
  createJobCommission,
  getAllJobCommissions,
  deleteJobCommission,
  updateJobCommission,
} = require("./job-commission.controller.js");
const {
  createJobCommissionSchema,
  getAllJobCommissionsSchema,
  deleteJobCommissionSchema,
  updateJobCommissionParamsSchema,
  updateJobCommissionSchema,
} = require("./job-commission.validation.js");
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
