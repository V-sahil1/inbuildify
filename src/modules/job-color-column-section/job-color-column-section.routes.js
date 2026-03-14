const express = require("express");
const router = express.Router();

const {
  createJobColorColumnSection,
  getJobColorColumnSections,
  deleteJobColorColumnSection,
  updateJobColorColumnSection,
} = require("./job-color-column-section.controller.js");
const {
  createJobColorColumnSectionSchema,
  getJobColorColumnSectionsSchema,
  deleteJobColorColumnSectionSchema,
  updateJobColorColumnSectionParamsSchema,
  updateJobColorColumnSectionSchema,
} = require("./job-color-column-section.validation.js");

const {
  createUpload,
  createPdfUpload,
  handleMulterError,
} = require("../../utils/s3Upload.js");
const { validateRequest } = require("../../middleware/validateRequestMiddleware.js");
const authMiddleware = require("../../middleware/authMiddleware.js");
const roleMiddleware = require("../../middleware/roleMiddleware.js");
const camelToSnakeMiddleware = require("../../middleware/caseConverterMiddleware.js");

const { REQUEST_SOURCE } = require("../../config/constants.js");

router.use(authMiddleware);
router.use(roleMiddleware);

const upload = createPdfUpload("job-color-column-section");

router.post(
  "/",
  upload.single("attachments"),
  handleMulterError,
  camelToSnakeMiddleware,
  validateRequest(createJobColorColumnSectionSchema, REQUEST_SOURCE.FORM_DATA),
  createJobColorColumnSection,
);

router.get(
  "/",
  camelToSnakeMiddleware,
  validateRequest(getJobColorColumnSectionsSchema, REQUEST_SOURCE.QUERY),
  getJobColorColumnSections,
);

router.delete(
  "/:job_color_column_section_id",
  validateRequest(deleteJobColorColumnSectionSchema, REQUEST_SOURCE.PARAMS),
  deleteJobColorColumnSection,
);

router.put(
  "/:job_color_column_section_id",
  upload.single("attachments"),
  camelToSnakeMiddleware,
  handleMulterError,
  validateRequest(
    updateJobColorColumnSectionParamsSchema,
    REQUEST_SOURCE.PARAMS,
  ),
  validateRequest(updateJobColorColumnSectionSchema, REQUEST_SOURCE.FORM_DATA),
  updateJobColorColumnSection,
);

module.exports = router;
