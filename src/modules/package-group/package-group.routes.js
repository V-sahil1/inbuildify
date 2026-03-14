const express = require("express");
const router = express.Router();

const {
  createPackageGroup,
  getAllPackageGroups,
  deletePackageGroup,
  updatePackageGroup,
} = require("./package-group.controller.js");
const {
  createPackageGroupSchema,
  getAllPackageGroupSchema,
  deletePackageGroupSchema,
  updatePackageGroupParamsSchema,
  updatePackageGroupSchema,
} = require("./package-group.validation.js");
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
