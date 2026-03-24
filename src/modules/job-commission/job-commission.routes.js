import express from "express";

const router = express.Router();

import {
  createJobCommission,
  getAllJobCommissions,
  deleteJobCommission,
  updateJobCommission,
} from "./job-commission.controller.js";
import {
  createJobCommissionSchema,
  getAllJobCommissionsSchema,
  deleteJobCommissionSchema,
  updateJobCommissionParamsSchema,
  updateJobCommissionSchema,
} from "./job-commission.validation.js";
import { validateRequest } from "../../middleware/validateRequestMiddleware.js";
import authMiddleware from "../../middleware/authMiddleware.js";
import roleMiddleware from "../../middleware/roleMiddleware.js";
import camelToSnakeMiddleware from "../../middleware/caseConverterMiddleware.js";
import { REQUEST_SOURCE } from "../../config/constants.js";

router.use(authMiddleware);
router.use(roleMiddleware);
router.use(camelToSnakeMiddleware);

router.post(
  "/",
  validateRequest(createJobCommissionSchema, REQUEST_SOURCE.BODY),
  createJobCommission,
);

router.get(
  "/",
  validateRequest(getAllJobCommissionsSchema, REQUEST_SOURCE.QUERY),
  getAllJobCommissions,
);

router.delete(
  "/:job_commission_id",
  validateRequest(deleteJobCommissionSchema, REQUEST_SOURCE.PARAMS),
  deleteJobCommission,
);

router.put(
  "/:job_commission_id",
  validateRequest(updateJobCommissionParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateJobCommissionSchema, REQUEST_SOURCE.BODY),
  updateJobCommission,
);

export default router;
