const express = require("express");
const router = express.Router();

const {
  createRolePermission,
  getAllRolePermission,
  deleteRolePermission,
  updateRolePermission,
  updateRolePermissionIsActive,
} = require("./role-permission.controller.js");
const {
  createRolePermissionSchema,
  getAllRolePermissionSchema,
  deleteRolePermissionSchema,
  updatePermissionIdSchemaSchema,
  updateRolePermissionSchema,
  updateRolePermissionIsActiveSchema,
} = require("./role-permission.validation.js");

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
