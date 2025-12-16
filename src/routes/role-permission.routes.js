const express = require("express");
const router = express.Router();

const {
  createRolePermission,
  getAllRolePermission,
  deleteRolePermission,
  updateRolePermission,
  updateRolePermissionIsActive,
} = require("../controllers/role-permission.controller");
const {
  createRolePermissionSchema,
  getAllRolePermissionSchema,
  deleteRolePermissionSchema,
  updatePermissionIdSchemaSchema,
  updateRolePermissionSchema,
  updateRolePermissionIsActiveSchema,
} = require("../validations/role-permission.validation");

const { validateRequest } = require("../middleware/validateRequestMiddleware");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const { REQUEST_SOURCE } = require("../config/constants");

router.use(authMiddleware);
router.use(roleMiddleware);

router.post(
  "/",
  validateRequest(createRolePermissionSchema, REQUEST_SOURCE.BODY),
  createRolePermission
);

router.get(
  "/",
  validateRequest(getAllRolePermissionSchema, REQUEST_SOURCE.QUERY),
  getAllRolePermission
);

router.delete(
  "/:id",
  validateRequest(deleteRolePermissionSchema, REQUEST_SOURCE.PARAMS),
  deleteRolePermission
);

router.put(
  "/:role_permission_id",
  validateRequest(updatePermissionIdSchemaSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateRolePermissionSchema, REQUEST_SOURCE.BODY),
  updateRolePermission
);

router.put(
  "/is-active/:role_permission_id",
  validateRequest(updatePermissionIdSchemaSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateRolePermissionIsActiveSchema, REQUEST_SOURCE.BODY),
  updateRolePermissionIsActive
);

module.exports = router;
