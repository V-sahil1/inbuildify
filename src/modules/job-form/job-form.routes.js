const express = require("express");
const router = express.Router();

const {
  createJobForm,
  getAllJobForms,
  getJobFormById,
  updateJobForm,
  deleteJobForm,
} = require("./job-form.controller.js");
const {
  createJobFormSchema,
  updateJobFormSchema,
  getJobFormByIdSchema,
  deleteJobFormSchema,
  getAllJobFormsSchema,
  updateJobFormParamsSchema,
} = require("./job-form.validation.js");
const { validateRequest } = require("../../middleware/validateRequestMiddleware.js");
const authMiddleware = require("../../middleware/authMiddleware.js");
const roleMiddleware = require("../../middleware/roleMiddleware.js");
const camelToSnakeMiddleware = require("../../middleware/caseConverterMiddleware.js");
const { REQUEST_SOURCE } = require("../../config/constants.js");

router.post(
  "/",
  authMiddleware,
  roleMiddleware,
  camelToSnakeMiddleware,
  validateRequest(createJobFormSchema, REQUEST_SOURCE.BODY),
  createJobForm,
);

router.get(
  "/",
  authMiddleware,
  roleMiddleware,
  validateRequest(getAllJobFormsSchema, REQUEST_SOURCE.QUERY),
  getAllJobForms,
);

router.get(
  "/:leads_id",
  authMiddleware,
  roleMiddleware,
  validateRequest(getJobFormByIdSchema, REQUEST_SOURCE.PARAMS),
  getJobFormById,
);

router.put(
  "/:job_form_id",
  authMiddleware,
  roleMiddleware,
  camelToSnakeMiddleware,
  validateRequest(updateJobFormParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateJobFormSchema, REQUEST_SOURCE.BODY),
  updateJobForm,
);

router.delete(
  "/:job_form_id",
  authMiddleware,
  roleMiddleware,
  validateRequest(deleteJobFormSchema, REQUEST_SOURCE.PARAMS),
  deleteJobForm,
);

module.exports = router;
