// src/routes/contractor.routes.js

const express = require("express");
const router = express.Router();
const {
  createContractor,
  getContractors,
  getContractorById,
  updateContractor,
  deleteContractor,
} = require("../controllers/contractor.controller");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const { validateRequest } = require("../middleware/validateRequestMiddleware");
const {
  createContractorSchema,
  getContractorByIdSchema,
  updateContractorParamsSchema,
  updateContractorSchema,
  deleteContractorSchema,
} = require("../validations/contractor.validation");
const { REQUEST_SOURCE } = require("../config/constants");

router.use(authMiddleware);
router.use(roleMiddleware);

router.post("/", validateRequest(createContractorSchema), createContractor);
router.get("/", getContractors);
router.get(
  "/:id",
  validateRequest(getContractorByIdSchema, REQUEST_SOURCE.PARAMS),
  getContractorById
);
router.put(
  "/:id",
  validateRequest(updateContractorParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateContractorSchema),
  updateContractor
);
router.delete(
  "/:id",
  validateRequest(deleteContractorSchema, REQUEST_SOURCE.PARAMS),
  deleteContractor
);

module.exports = router;
