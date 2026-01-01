const express = require("express");
const router = express.Router();

const {
  createJobColorColumnSection,
  getJobColorColumnSections,
  deleteJobColorColumnSection,
  updateJobColorColumnSection,
} = require("../controllers/job-color-column-section.controller.js");
const {
  createJobColorColumnSectionSchema,
  getJobColorColumnSectionsSchema,
  deleteJobColorColumnSectionSchema,
  updateJobColorColumnSectionParamsSchema,
  updateJobColorColumnSectionSchema,
} = require("../validations/job-color-column-section.validation.js");

const { validateRequest } = require("../middleware/validateRequestMiddleware");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const camelToSnakeMiddleware = require("../middleware/caseConverterMiddleware.js");
const { createUpload, handleMulterError } = require("../utils/s3Upload");

const { REQUEST_SOURCE } = require("../config/constants");

router.use(authMiddleware);
router.use(roleMiddleware);
const upload = createUpload("job-color-column-section");

router.post(
  "/",
  upload.single("attachment"),
  camelToSnakeMiddleware,
  handleMulterError,
  validateRequest(createJobColorColumnSectionSchema, REQUEST_SOURCE.FORM_DATA),
  createJobColorColumnSection
);

router.get(
  "/",
  camelToSnakeMiddleware,
  validateRequest(getJobColorColumnSectionsSchema, REQUEST_SOURCE.QUERY),
  getJobColorColumnSections
);

router.delete(
  "/:job_color_column_section_id",
  validateRequest(deleteJobColorColumnSectionSchema, REQUEST_SOURCE.PARAMS),
  deleteJobColorColumnSection
);

router.put(
  "/:job_color_column_section_id",
  upload.single("attachment"),
  handleMulterError,
  camelToSnakeMiddleware,
  validateRequest(
    updateJobColorColumnSectionParamsSchema,
    REQUEST_SOURCE.PARAMS
  ),
  validateRequest(updateJobColorColumnSectionSchema, REQUEST_SOURCE.BODY),
  updateJobColorColumnSection
);

module.exports = router;
