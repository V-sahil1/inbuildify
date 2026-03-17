import getPool from "../../config/database.js";
import { successResponse, errorResponse } from "../../helper/response.js";
import { keysToCamelCase } from "../../utils/common.js";

const getUsersDetails = async (client, userIds) => {
  if (!userIds || userIds.length === 0) {
    return {};
  }

  const validUserIds = userIds.filter(Boolean);
  if (validUserIds.length === 0) {
    return {};
  }

  const usersQuery = `
    SELECT users_id, name 
    FROM users 
    WHERE users_id = ANY($1::uuid[])
  `;
  const usersResult = await client.query(usersQuery, [validUserIds]);

  return usersResult.rows.reduce((acc, row) => {
    acc[row.users_id] = row.name;
    return acc;
  }, {});
};

const formatUserObject = (userId, usersMap) => {
  if (!userId) {
    return null;
  }
  return {
    id: userId,
    name: usersMap[userId] || null,
  };
};

export async function getAllColorSubCategories(req, res) {
  const { color_category_id: colorCategoryId } = req.params;
  const { limit, offset } = req.query;
  const parsedLimit = parseInt(limit, 10) || 25;
  const parsedOffset = parseInt(offset, 10) || 0;

  const pool = getPool();
  const client = await pool.connect();
  try {
    const params = [req.user.builder_id, parsedLimit, parsedOffset];
    let filterClause = "";
    if (colorCategoryId) {
      params.push(colorCategoryId);
      filterClause = " AND sc.color_category_id = $4 ";
    }

    const result = await client.query(
      `SELECT sc.*
       FROM color_sub_category sc
       JOIN color_category cc ON sc.color_category_id = cc.color_category_id
       WHERE cc.builder_id = $1 AND sc.is_deleted = false ${filterClause}
       ORDER BY sc.created_at DESC LIMIT $2 OFFSET $3`,
      params,
    );

    const countParams = [req.user.builder_id];
    let countFilter = "";
    if (colorCategoryId) {
      countParams.push(colorCategoryId);
      countFilter = " AND sc.color_category_id = $2 ";
    }
    const totalResult = await client.query(
      `SELECT COUNT(*)
       FROM color_sub_category sc
       JOIN color_category cc ON sc.color_category_id = cc.color_category_id
       WHERE cc.builder_id = $1 AND sc.is_deleted = false ${countFilter}`,
      countParams,
    );

    // Get all unique user IDs
    const userIds = new Set();
    result.rows.forEach((row) => {
      if (row.created_by_id) {
        userIds.add(row.created_by_id);
      }
      if (row.updated_by_id) {
        userIds.add(row.updated_by_id);
      }
    });

    const usersMap = await getUsersDetails(client, Array.from(userIds));

    // Format response with user details
    const colorSubCategories = result.rows.map((row) => {
      const formatted = keysToCamelCase(row);
      return {
        ...formatted,
        createdBy: formatUserObject(row.created_by_id, usersMap),
        updatedBy: formatUserObject(row.updated_by_id, usersMap),
      };
    });

    const totalItems = parseInt(totalResult.rows[0].count, 10);
    const totalPages = Math.ceil(totalItems / parsedLimit);
    const currentPage = Math.floor(parsedOffset / parsedLimit) + 1;

    return successResponse(
      res,
      {
        colorSubCategories,
        pagination: { totalItems, totalPages, currentPage, limit: parsedLimit },
      },
      "Color sub-categories fetched successfully.",
    );
  } catch (error) {
    return errorResponse(
      res,
      error?.statusCode || 400,
      error?.message || "Failed to fetch color sub-categories.",
    );
  } finally {
    client.release();
  }
}

export async function getColorSubCategoryById(req, res) {
  const { color_sub_category_id } = req.params;
  const builderId = req.user.builder_id;

  const pool = getPool();
  const client = await pool.connect();

  try {
    const result = await client.query(
      `SELECT sc.* FROM color_sub_category sc
       JOIN color_category cc ON sc.color_category_id = cc.color_category_id
       WHERE sc.color_sub_category_id = $1 AND cc.builder_id = $2 AND sc.is_deleted = false`,
      [color_sub_category_id, builderId],
    );

    if (result.rowCount === 0) {
      return errorResponse(res, 404, "Color sub-category not found.");
    }

    const row = result.rows[0];
    const userIds = [row.created_by_id, row.updated_by_id].filter(Boolean);
    const usersMap = await getUsersDetails(client, userIds);

    const formatted = keysToCamelCase(row);
    const response = {
      ...formatted,
      createdBy: formatUserObject(row.created_by_id, usersMap),
      updatedBy: formatUserObject(row.updated_by_id, usersMap),
    };

    return successResponse(
      res,
      response,
      "Color sub-category fetched successfully.",
    );
  } catch (error) {
    console.error("Get color sub-category by ID error:", error);
    return errorResponse(res, 500, "Failed to fetch color sub-category.");
  } finally {
    client.release();
  }
}

export async function createColorSubCategory(req, res) {
  const { colorCategoryId, name, description } = req.body;
  const builderId = req.user.builder_id;
  const userId = req.user.users_id;

  const pool = getPool();
  const client = await pool.connect();

  try {
    const parent = await client.query(
      "SELECT 1 FROM color_category WHERE color_category_id = $1 AND builder_id = $2 AND is_deleted = false",
      [colorCategoryId, builderId],
    );
    if (parent.rowCount === 0) {
      return errorResponse(res, 400, "Invalid colorCategoryId.");
    }

    const dup = await client.query(
      "SELECT 1 FROM color_sub_category WHERE color_category_id = $1 AND name = $2 AND is_deleted = false",
      [colorCategoryId, name],
    );
    if (dup.rowCount > 0) {
      return errorResponse(
        res,
        400,
        "Color sub-category name already exists in this category.",
      );
    }

    const result = await client.query(
      `INSERT INTO color_sub_category (color_category_id, name, description, created_by_id, updated_by_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [colorCategoryId, name, description || null, userId, userId],
    );

    const row = result.rows[0];
    const usersMap = await getUsersDetails(client, [userId]);

    const formatted = keysToCamelCase(row);
    const response = {
      ...formatted,
      createdBy: formatUserObject(row.created_by_id, usersMap),
      updatedBy: formatUserObject(row.updated_by_id, usersMap),
    };

    return successResponse(
      res,
      response,
      "Color sub-category created successfully.",
    );
  } catch (error) {
    console.error("Create color sub-category error:", error);
    return errorResponse(res, 500, "Failed to create color sub-category.");
  } finally {
    client.release();
  }
}

export async function updateColorSubCategory(req, res) {
  const { color_sub_category_id } = req.params;
  const { name, description } = req.body;
  const builderId = req.user.builder_id;
  const userId = req.user.users_id;

  const pool = getPool();
  const client = await pool.connect();

  try {
    // verify it belongs to builder
    const exists = await client.query(
      `SELECT sc.color_sub_category_id FROM color_sub_category sc
       JOIN color_category cc ON sc.color_category_id = cc.color_category_id
       WHERE sc.color_sub_category_id = $1 AND cc.builder_id = $2 AND sc.is_deleted = false`,
      [color_sub_category_id, builderId],
    );
    if (exists.rowCount === 0) {
      return errorResponse(
        res,
        404,
        "Color sub-category not found or already deleted.",
      );
    }

    const result = await client.query(
      `UPDATE color_sub_category
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           updated_by_id = $3,
           updated_at = NOW()
       WHERE color_sub_category_id = $4 AND is_deleted = false
       RETURNING *`,
      [name || null, description || null, userId, color_sub_category_id],
    );

    const row = result.rows[0];
    const userIds = [row.created_by_id, row.updated_by_id].filter(Boolean);
    const usersMap = await getUsersDetails(client, userIds);

    const formatted = keysToCamelCase(row);
    const response = {
      ...formatted,
      createdBy: formatUserObject(row.created_by_id, usersMap),
      updatedBy: formatUserObject(row.updated_by_id, usersMap),
    };

    return successResponse(
      res,
      response,
      "Color sub-category updated successfully.",
    );
  } catch (error) {
    console.error("Update color sub-category error:", error);
    return errorResponse(res, 500, "Failed to update color sub-category.");
  } finally {
    client.release();
  }
}

export async function deleteColorSubCategory(req, res) {
  const { color_sub_category_id } = req.params;
  const builderId = req.user.builder_id;
  const userId = req.user.users_id;

  const pool = getPool();
  const client = await pool.connect();
  try {
    // verify
    const exists = await client.query(
      `SELECT sc.color_sub_category_id FROM color_sub_category sc
       JOIN color_category cc ON sc.color_category_id = cc.color_category_id
       WHERE sc.color_sub_category_id = $1 AND cc.builder_id = $2 AND sc.is_deleted = false`,
      [color_sub_category_id, builderId],
    );
    if (exists.rowCount === 0) {
      return errorResponse(
        res,
        404,
        "Color sub-category not found or already deleted.",
      );
    }

    const result = await client.query(
      `UPDATE color_sub_category 
       SET is_deleted = true, updated_by_id = $2, updated_at = NOW()
       WHERE color_sub_category_id = $1 AND is_deleted = false RETURNING *`,
      [color_sub_category_id, userId],
    );

    const row = result.rows[0];
    const userIds = [row.created_by_id, row.updated_by_id].filter(Boolean);
    const usersMap = await getUsersDetails(client, userIds);

    const formatted = keysToCamelCase(row);
    const response = {
      ...formatted,
      createdBy: formatUserObject(row.created_by_id, usersMap),
      updatedBy: formatUserObject(row.updated_by_id, usersMap),
    };

    return successResponse(
      res,
      response,
      "Color sub-category deleted successfully.",
    );
  } catch (error) {
    console.error("Delete color sub-category error:", error);
    return errorResponse(res, 500, "Failed to delete color sub-category.");
  } finally {
    client.release();
  }
}
