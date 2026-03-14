const express = require("express");
const router = express.Router();

const {
  createRole,
  getAllRole,
  deleteRole,
  updateRole,
} = require("./role.controller.js");
const {
  createRoleSchema,
  getAllRoleSchema,
  deleteRoleSchema,
  updateRoleIdParamsSchema,
  updateRoleSchema,
} = require("./role.validation.js");

const { validateRequest } = require("../../middleware/validateRequestMiddleware.js");
const authMiddleware = require("../../middleware/authMiddleware.js");
const roleMiddleware = require("../../middleware/roleMiddleware.js");
const camelToSnakeMiddleware = require("../../middleware/caseConverterMiddleware.js");

const { REQUEST_SOURCE } = require("../../config/constants.js");

router.use(camelToSnakeMiddleware);

router.post(
  "/",
  validateRequest(createRoleSchema, REQUEST_SOURCE.BODY),
  createRole
);

router.get(
  "/",
  validateRequest(getAllRoleSchema, REQUEST_SOURCE.QUERY),
  getAllRole
);

router.delete(
  "/:id",
  validateRequest(deleteRoleSchema, REQUEST_SOURCE.PARAMS),
  deleteRole
);

router.put(
  "/:role_id",
  validateRequest(updateRoleIdParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateRoleSchema, REQUEST_SOURCE.BODY),
  updateRole
);
module.exports = router;
