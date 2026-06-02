import db from "../../config/database/models/postgre-models/index.js";
import { keysToCamelCase } from "../../utils/common.js";
import { DEFAULT_LIMIT } from "../../config/constants.js";

/**
 * Fetches all roles with pagination.
 */
export async function getAllRoleService(page = 1, limit = DEFAULT_LIMIT) {
  const { Role } = db;

  const pageValue = parseInt(page, 10) || 1;
  const limitValue = parseInt(limit, 10) || DEFAULT_LIMIT;
  const offset = (pageValue - 1) * limitValue;

  const { count, rows } = await Role.findAndCountAll({
    order: [["createdAt", "DESC"]],
    limit: limitValue,
    offset: offset,
  });

  const totalPages = Math.ceil(count / limitValue);

  return {
    data: {
      role: keysToCamelCase(rows.map((r) => r.get({ plain: true }))),
      pagination: {
        currentPage: pageValue,
        totalPages,
        totalRecords: count,
        limit: limitValue,
      },
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

