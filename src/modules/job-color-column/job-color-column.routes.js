const express = require("express");
const router = express.Router();

const {
  createJobColorColumn,
  getAllJobColorColumns,
  updateJobColorColumn,
} = require("./job-color-column.controller.js");
const {
  createJobColorCoulmnSchema,
  getJobColorColumnSchema,
  updateJobColorColumnParamsSchema,
  updateJobColorColumnSchema,
} = require("./job-color-column.validation.js");

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
  validateRequest(createJobColorCoulmnSchema, REQUEST_SOURCE.BODY),
  createJobColorColumn
);

router.get(
  "/",
  validateRequest(getJobColorColumnSchema, REQUEST_SOURCE.QUERY),
  getAllJobColorColumns
);

router.put(
  "/:id",
  validateRequest(updateJobColorColumnParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateJobColorColumnSchema, REQUEST_SOURCE.BODY),
  updateJobColorColumn
);
module.exports = router;
