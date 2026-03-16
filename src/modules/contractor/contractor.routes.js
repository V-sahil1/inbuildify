import express from "express";

const router = express.Router();

import {
  createContractor,
  getContractors,
  getContractorById,
  updateContractor,
  deleteContractor,
} from "./contractor.controller";
import authMiddleware from "../../middleware/authMiddleware";
import roleMiddleware from "../../middleware/roleMiddleware";
import { validateRequest } from "../../middleware/validateRequestMiddleware";
import {
  createContractorSchema,
  getContractorByIdSchema,
  updateContractorParamsSchema,
  updateContractorSchema,
  deleteContractorSchema,
} from "./contractor.validation";
import { REQUEST_SOURCE } from "../../config/constants";

router.use(authMiddleware);
router.use(roleMiddleware);

router.post("/", validateRequest(createContractorSchema), createContractor);
router.get("/", getContractors);
router.get(
  "/:id",
  validateRequest(getContractorByIdSchema, REQUEST_SOURCE.PARAMS),
  getContractorById,
);
router.put(
  "/:id",
  validateRequest(updateContractorParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateContractorSchema),
  updateContractor,
);
router.delete(
  "/:id",
  validateRequest(deleteContractorSchema, REQUEST_SOURCE.PARAMS),
  deleteContractor,
);

export default router;
