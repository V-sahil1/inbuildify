import db from "../../config/database/models/postgre-models/index.js";
import { keysToCamelCase } from "../../utils/common.js";

/**
 * Fetches all roles with pagination.
 */
export async function getAllRoleService() {
  const { Role } = db;

  const rows = await Role.findAll({
    order: [["created_at", "DESC"]],
  });

  return {
    data: {
      role: keysToCamelCase(rows.map((r) => r.get({ plain: true }))),
    },
  };
}

/**
 * Checks if a role exists by its ID.
 */
export async function roleExistsService(roleId) {
  const { Role } = db;

  const count = await Role.count({
    where: { role_id: roleId },
  });

  return count > 0;
}

