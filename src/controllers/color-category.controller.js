const getPool = require("../config/database");
const { successResponse, errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

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

    const totalItems = parseInt(totalResult.rows[0].count, 10);
    const totalPages = Math.ceil(totalItems / parsedLimit);
    const currentPage = Math.floor(parsedOffset / parsedLimit) + 1;

    return successResponse(
      res,
      {
        colorCategories: keysToCamelCase(result.rows),
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

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
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
      `INSERT INTO color_category (builder_id, name, description) VALUES ($1, $2, $3) RETURNING *`,
      [builderId, name, description || null]
    );

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
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
           updated_at = NOW()
       WHERE color_category_id = $3 AND builder_id = $4 AND is_deleted = false
       RETURNING *`,
      [name || null, description || null, color_category_id, builderId]
    );

    if (result.rowCount === 0) {
      return errorResponse(res, 404, "Color category not found or already deleted.");
    }

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
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

  const pool = getPool();
  const client = await pool.connect();

  try {
    const result = await client.query(
      `UPDATE color_category SET is_deleted = true
       WHERE color_category_id = $1 AND builder_id = $2 AND is_deleted = false
       RETURNING *`,
      [color_category_id, builderId]
    );

    if (result.rowCount === 0) {
      return errorResponse(res, 404, "Color category not found or already deleted.");
    }

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Color category deleted successfully."
    );
  } catch (error) {
    console.error("Delete color category error:", error);
    return errorResponse(res, 500, "Failed to delete color category.");
  } finally {
    client.release();
  }
};
