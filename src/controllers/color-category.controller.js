const getPool = require("../config/database");
const { successResponse, errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

const getUsersDetails = async (client, userIds) => {
  if (!userIds || userIds.length === 0) return {};
  
  const validUserIds = userIds.filter(Boolean);
  if (validUserIds.length === 0) return {};

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
  if (!userId) return null;
  return {
    id: userId,
    name: usersMap[userId] || null
  };
};

exports.getAllColorCategories = async (req, res) => {
  const { limit, offset } = req.query;
  const parsedLimit = parseInt(limit, 10) || 25;
  const parsedOffset = parseInt(offset, 10) || 0;

  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT * FROM color_category WHERE builder_id = $1 AND is_deleted = false
       ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [req.user.builder_id, parsedLimit, parsedOffset]
    );

    const totalResult = await client.query(
      `SELECT COUNT(*) FROM color_category WHERE builder_id = $1 AND is_deleted = false`,
      [req.user.builder_id]
    );

    const userIds = new Set();
    result.rows.forEach(row => {
      if (row.created_by_id) userIds.add(row.created_by_id);
      if (row.updated_by_id) userIds.add(row.updated_by_id);
    });

    const usersMap = await getUsersDetails(client, Array.from(userIds));

    const colorCategories = result.rows.map(row => {
      const formatted = keysToCamelCase(row);
      return {
        ...formatted,
        createdBy: formatUserObject(row.created_by_id, usersMap),
        updatedBy: formatUserObject(row.updated_by_id, usersMap)
      };
    });

    const totalItems = parseInt(totalResult.rows[0].count, 10);
    const totalPages = Math.ceil(totalItems / parsedLimit);
    const currentPage = Math.floor(parsedOffset / parsedLimit) + 1;

    return successResponse(
      res,
      {
        colorCategories,
        pagination: {
          totalItems,
          totalPages,
          currentPage,
          limit: parsedLimit,
        },
      },
      "Color categories fetched successfully."
    );
  } catch (error) {
    return errorResponse(
      res,
      error?.statusCode || 400,
      error?.message || "Failed to fetch color categories."
    );
  } finally {
    client.release();
  }
};

exports.getColorCategoryById = async (req, res) => {
  const { color_category_id } = req.params;
  const builderId = req.user.builder_id;

  const pool = getPool();
  const client = await pool.connect();

  try {
    const result = await client.query(
      `SELECT * FROM color_category WHERE color_category_id = $1 AND builder_id = $2 AND is_deleted = false`,
      [color_category_id, builderId]
    );

    if (result.rowCount === 0) {
      return errorResponse(res, 404, "Color category not found.");
    }

    const row = result.rows[0];
    const userIds = [row.created_by_id, row.updated_by_id].filter(Boolean);
    const usersMap = await getUsersDetails(client, userIds);

    const formatted = keysToCamelCase(row);
    const response = {
      ...formatted,
      createdBy: formatUserObject(row.created_by_id, usersMap),
      updatedBy: formatUserObject(row.updated_by_id, usersMap)
    };

    return successResponse(
      res,
      response,
      "Color category fetched successfully."
    );
  } catch (error) {
    console.error("Get color category by ID error:", error);
    return errorResponse(res, 500, "Failed to fetch color category.");
  } finally {
    client.release();
  }
};

exports.createColorCategory = async (req, res) => {
  const { name, description } = req.body;
  const builderId = req.user.builder_id;
  const userId = req.user.users_id;

  const pool = getPool();
  const client = await pool.connect();

  try {
    const checkNameExists = await client.query(
      `SELECT 1 FROM color_category WHERE name = $1 AND builder_id = $2 AND is_deleted = false`,
      [name, builderId]
    );
    if (checkNameExists.rowCount > 0) {
      return errorResponse(res, 400, "Color category name already exists.");
    }

    const result = await client.query(
      `INSERT INTO color_category (builder_id, name, description, created_by_id, updated_by_id) 
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [builderId, name, description || null, userId, userId]
    );

    const row = result.rows[0];
    const usersMap = await getUsersDetails(client, [userId]);

    const formatted = keysToCamelCase(row);
    const response = {
      ...formatted,
      createdBy: formatUserObject(row.created_by_id, usersMap),
      updatedBy: formatUserObject(row.updated_by_id, usersMap)
    };

    return successResponse(
      res,
      response,
      "Color category created successfully."
    );
  } catch (error) {
    console.error("Create color category error:", error);
    return errorResponse(res, 500, "Failed to create color category.");
  } finally {
    client.release();
  }
};

exports.updateColorCategory = async (req, res) => {
  const { color_category_id } = req.params;
  const { name, description } = req.body;
  const builderId = req.user.builder_id;
  const userId = req.user.users_id;

  const pool = getPool();
  const client = await pool.connect();

  try {
    const checkNameExists = await client.query(
      `SELECT 1 FROM color_category WHERE name = $1 AND builder_id = $2 AND color_category_id != $3 AND is_deleted = false`,
      [name, builderId, color_category_id]
    );
    if (checkNameExists.rowCount > 0) {
      return errorResponse(res, 400, "Color category name already exists.");
    }

    const result = await client.query(
      `UPDATE color_category
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           updated_by_id = $3,
           updated_at = NOW()
       WHERE color_category_id = $4 AND builder_id = $5 AND is_deleted = false
       RETURNING *`,
      [name || null, description || null, userId, color_category_id, builderId]
    );

    if (result.rowCount === 0) {
      return errorResponse(res, 404, "Color category not found or already deleted.");
    }

    const row = result.rows[0];
    const userIds = [row.created_by_id, row.updated_by_id].filter(Boolean);
    const usersMap = await getUsersDetails(client, userIds);

    const formatted = keysToCamelCase(row);
    const response = {
      ...formatted,
      createdBy: formatUserObject(row.created_by_id, usersMap),
      updatedBy: formatUserObject(row.updated_by_id, usersMap)
    };

    return successResponse(
      res,
      response,
      "Color category updated successfully."
    );
  } catch (error) {
    console.error("Update color category error:", error);
    return errorResponse(res, 500, "Failed to update color category.");
  } finally {
    client.release();
  }
};

exports.deleteColorCategory = async (req, res) => {
  const { color_category_id } = req.params;
  const builderId = req.user.builder_id;
  const userId = req.user.users_id;

  const pool = getPool();
  const client = await pool.connect();

  try {
    const result = await client.query(
      `UPDATE color_category 
       SET is_deleted = true, updated_by_id = $3, updated_at = NOW()
       WHERE color_category_id = $1 AND builder_id = $2 AND is_deleted = false
       RETURNING *`,
      [color_category_id, builderId, userId]
    );

    if (result.rowCount === 0) {
      return errorResponse(res, 404, "Color category not found or already deleted.");
    }

    const row = result.rows[0];
    const userIds = [row.created_by_id, row.updated_by_id].filter(Boolean);
    const usersMap = await getUsersDetails(client, userIds);

    const formatted = keysToCamelCase(row);
    const response = {
      ...formatted,
      createdBy: formatUserObject(row.created_by_id, usersMap),
      updatedBy: formatUserObject(row.updated_by_id, usersMap)
    };

    return successResponse(
      res,
      response,
      "Color category deleted successfully."
    );
  } catch (error) {
    console.error("Delete color category error:", error);
    return errorResponse(res, 500, "Failed to delete color category.");
  } finally {
    client.release();
  }
};
