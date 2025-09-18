const getPool = require("../config/database");
const { successResponse, errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.getAllCategories = async (req, res) => {
  const { limit, offset } = req.query;
  const parsedLimit = parseInt(limit, 10) || 25;
  const parsedOffset = parseInt(offset, 10) || 0;

  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT * FROM categories WHERE builder_id = $1 AND is_deleted = false
      ORDER BY display_order ASC LIMIT $2 OFFSET $3`,
      [req.user.builder_id, parsedLimit, parsedOffset]
    );

    const totalResult = await client.query(`SELECT COUNT(*) FROM categories WHERE builder_id = $1 AND is_deleted = false`, [req.user.builder_id]);

    const totalItems = parseInt(totalResult.rows[0].count, 10);
    const totalPages = Math.ceil(totalItems / parsedLimit);
    const currentPage = Math.floor(parsedOffset / parsedLimit) + 1;

    return successResponse(
      res,
      {
        categories: keysToCamelCase(result.rows),
        pagination: {
          totalItems,
          totalPages,
          currentPage,
          limit: parsedLimit,
        },
      },
      "Categories fetched successfully."
    );
  } catch (error) {
    return errorResponse(
      res,
      error?.statusCode || 400,
      error?.message || "Failed to fetch categories."
    );
  } finally {
    client.release();
  }
};

exports.getCategoryById = async (req, res) => {
  const { id } = req.params;
  const builderId = req.user.builder_id;

  const pool = getPool();
  const client = await pool.connect();

  try {
    const result = await client.query(
      `
      SELECT * FROM categories
      WHERE category_id = $1 AND builder_id = $2 AND is_deleted = false
      `,
      [id, builderId]
    );

    if (result.rowCount === 0) {
      return errorResponse(res, 404, "Category not found.");
    }

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Category fetched successfully."
    );
  } catch (error) {
    console.error("Get category by ID error:", error);
    return errorResponse(res, 500, "Failed to fetch category.");
  } finally {
    client.release();
  }
};

exports.createCategory = async (req, res) => {
  const { name, description } = req.body;
  const builderId = req.user.builder_id;

  const pool = getPool();
  const client = await pool.connect();

  try {
    const checkNameExists = await client.query(
      `SELECT * FROM categories WHERE name = $1 AND builder_id = $2 AND is_deleted = false`,
      [name, builderId]
    );
    if (checkNameExists.rowCount > 0) {
      return errorResponse(res, 400, "Category name already exists.");
    }

    const orderResult = await client.query(
      `SELECT COALESCE(MAX(display_order), 0) + 1 AS next_order 
       FROM categories WHERE builder_id = $1`,
      [builderId]
    );
    const displayOrder = orderResult.rows[0].next_order;

    const result = await client.query(
      `
      INSERT INTO categories (builder_id, name, description, display_order)
      VALUES ($1, $2, $3, $4)
      RETURNING *
      `,
      [builderId, name, description || null, displayOrder]
    );

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Category created successfully."
    );
  } catch (error) {
    console.error("Create category error:", error);
    return errorResponse(res, 500, "Failed to create category.");
  } finally {
    client.release();
  }
};

exports.updateCategory = async (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;
  const builderId = req.user.builder_id;

  const pool = getPool();
  const client = await pool.connect();

  try {
    const result = await client.query(
      `
      UPDATE categories
      SET name = COALESCE($1, name),
          description = COALESCE($2, description),
          updated_at = NOW()
      WHERE category_id = $3 AND builder_id = $4 AND is_deleted = false
      RETURNING *
      `,
      [name || null, description || null, id, builderId]
    );

    if (result.rowCount === 0) {
      return errorResponse(res, 404, "Category not found or already deleted.");
    }

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Category updated successfully."
    );
  } catch (error) {
    console.error("Update category error:", error);
    return errorResponse(res, 500, "Failed to update category.");
  } finally {
    client.release();
  }
};

exports.displayOrderManage = async (req, res) => {
  const { orderedCategories } = req.body;
  const builderId = req.user.builder_id;

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const categoryIds = orderedCategories.map((c) => c.categoryId);

    const { rows: existingCategories } = await client.query(
      `
      SELECT category_id
      FROM categories
      WHERE builder_id = $1
        AND is_deleted = false
        AND category_id = ANY($2::uuid[])
      `,
      [builderId, categoryIds]
    );

    const validIds = existingCategories.map((c) => c.category_id);
    const invalidIds = categoryIds.filter((id) => !validIds.includes(id));

    if (invalidIds.length > 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        `Invalid or deleted categories: ${invalidIds.join(", ")}`
      );
    }

    const cases = [];
    const values = [builderId];
    let i = 2;
    for (const { categoryId, displayOrder } of orderedCategories) {
      cases.push(`WHEN category_id = $${i} THEN $${i + 1}::int`);
      values.push(categoryId, Number(displayOrder));
      i += 2;
    }    

    const query = `
      UPDATE categories
      SET display_order = CASE ${cases.join(" ")} END,
          updated_at = NOW()
      WHERE builder_id = $1
        AND category_id = ANY($${i}::uuid[])
      RETURNING *
    `;
    values.push(categoryIds);

    const { rows: updatedRows } = await client.query(query, values);

    await client.query("COMMIT");

    return successResponse(
      res,
      '', // keysToCamelCase(updatedRows),
      "Category display orders updated successfully."
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Display order manage error:", error);
    return errorResponse(res, res.statusCode || 400, error?.message || "Failed to manage category display orders.");
  } finally {
    client.release();
  }
};

exports.deleteCategory = async (req, res) => {
  const { id } = req.params;
  const builderId = req.user.builder_id;

  const pool = getPool();
  const client = await pool.connect();

  try {
    const checkCategoryExists = await client.query(
      `SELECT * FROM categories WHERE category_id = $1 AND builder_id = $2 AND is_deleted = false`,
      [id, builderId]
    );

    if (checkCategoryExists.rowCount === 0) {
      return errorResponse(res, 404, "Category not found or already deleted.");
    }

    const result = await client.query(
      `
      UPDATE categories
      SET is_deleted = true
      WHERE category_id = $1 AND builder_id = $2
      RETURNING *
      `,
      [id, builderId]
    );

    if (result.rowCount === 0) {
      return errorResponse(res, 404, "Category not found or already deleted.");
    }

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Category deleted successfully."
    );
  } catch (error) {
    console.error("Delete category error:", error);
    return errorResponse(res, 500, "Failed to delete category.");
  } finally {
    client.release();
  }
};
