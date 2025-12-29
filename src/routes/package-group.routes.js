const express = require("express");
const router = express.Router();

const {
  createPackageGroup,
  getAllPackageGroups,
  deletePackageGroup,
  updatePackageGroup,
} = require("../controllers/package-group.controller");
const {
  createPackageGroupSchema,
  getAllPackageGroupSchema,
  deletePackageGroupSchema,
  updatePackageGroupParamsSchema,
  updatePackageGroupSchema,
} = require("../validations/package-group.validation");
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
  validateRequest(createPackageGroupSchema, REQUEST_SOURCE.BODY),
  createPackageGroup
);

router.get(
  "/",
  validateRequest(getAllPackageGroupSchema, REQUEST_SOURCE.QUERY),
  getAllPackageGroups
);

router.delete(
  "/:package_group_id",
  validateRequest(deletePackageGroupSchema, REQUEST_SOURCE.PARAMS),
  deletePackageGroup
);

router.put(
  "/:package_group_id",
  validateRequest(updatePackageGroupParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updatePackageGroupSchema, REQUEST_SOURCE.BODY),
  updatePackageGroup
);
module.exports = router;
