const express = require("express");
const router = express.Router();

const {
  createJobColorColumn,
  getAllJobColorColumns,
  updateJobColorColumn,
} = require("../controllers/job-color-column.controller");
const {
  createJobColorCoulmnSchema,
  getJobColorColumnSchema,
  updateJobColorColumnParamsSchema,
  updateJobColorColumnSchema,
} = require("../validations/job-color-column.validation");

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
