const express = require("express");
const router = express.Router();

const {
  createJobForm,
  getAllJobForms,
  getJobFormById,
  updateJobForm,
  deleteJobForm,
} = require("../controllers/job-form.controller");
const {
  createJobFormSchema,
  updateJobFormSchema,
  getJobFormByIdSchema,
  deleteJobFormSchema,
  getAllJobFormsSchema,
} = require("../validations/job-form.validation");
const { validateRequest } = require("../middleware/validateRequestMiddleware");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const camelToSnakeMiddleware = require("../middleware/caseConverterMiddleware.js");
const { REQUEST_SOURCE } = require("../config/constants");

// JOB FORM ROUTES

// Create a new job form
router.post(
  "/",
  authMiddleware,
  roleMiddleware,
  camelToSnakeMiddleware,
  validateRequest(createJobFormSchema, REQUEST_SOURCE.BODY),
  createJobForm,
);

// Get all job forms with pagination and search
router.get(
  "/",
  authMiddleware,
  roleMiddleware,
  validateRequest(getAllJobFormsSchema, REQUEST_SOURCE.QUERY),
  getAllJobForms,
);

// Get a specific job form by ID
router.get(
  "/:job_form_id",
  authMiddleware,
  roleMiddleware,
  validateRequest(getJobFormByIdSchema, REQUEST_SOURCE.PARAMS),
  getJobFormById,
);

// Update a job form
router.put(
  "/:job_form_id",
  authMiddleware,
  roleMiddleware,
  camelToSnakeMiddleware,
  validateRequest(getJobFormByIdSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateJobFormSchema, REQUEST_SOURCE.BODY),
  updateJobForm,
);

// Delete a job form
router.delete(
  "/:job_form_id",
  authMiddleware,
  roleMiddleware,
  validateRequest(deleteJobFormSchema, REQUEST_SOURCE.PARAMS),
  deleteJobForm,
);

module.exports = router;
