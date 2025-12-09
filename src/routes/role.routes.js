const express = require("express");
const router = express.Router();

const {
  createRole,
  getAllRole,
  deleteRole,
  updateRole,
} = require("../controllers/role.controller");
const {
  createRoleSchema,
  getAllRoleSchema,
  deleteRoleSchema,
  updateRoleIdParamsSchema,
  updateRoleSchema,
} = require("../validations/role.validation");

const { validateRequest } = require("../middleware/validateRequestMiddleware");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const { REQUEST_SOURCE } = require("../config/constants");

router.use(authMiddleware);
router.use(roleMiddleware);

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
