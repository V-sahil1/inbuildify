import getPool from "../../config/database.js";
import { successResponse, errorResponse } from "../../helper/response.js";
import { keysToCamelCase } from "../../utils/common.js";

export async function getAllMasterPriceListCategories(req, res) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const builderId = req.user.builder_id;
    const { page = 1, limit = 25 } = req.query;

    const limitValue = parseInt(limit, 10);
    const pageValue = parseInt(page, 10);
    const offset = (pageValue - 1) * limitValue;

    const dataQuery = `
      SELECT 
       *
      FROM master_price_list_categories m
      WHERE m.builder_id = $1 AND is_deleted = FALSE
      ORDER BY m.created_at DESC
      LIMIT $2 OFFSET $3;
    `;

    const dataResult = await client.query(dataQuery, [
      builderId,
      limitValue,
      offset,
    ]);

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM master_price_list_categories
      WHERE builder_id = $1;
    `;
    const countResult = await client.query(countQuery, [builderId]);
    const totalRecords = parseInt(countResult.rows[0].total, 10);
    const totalPages = Math.ceil(totalRecords / limitValue);

    return successResponse(
      res,
      {
        masterPriceListCategory: keysToCamelCase(dataResult.rows),
        pagination: {
          currentPage: pageValue,
          totalPages,
          totalRecords,
          limit: limitValue,
        },
      },
      "Master price list category fetched successfully.",
    );
  } catch (error) {
    console.error("Error fetching master price list category:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
}

export async function getMasterPriceListCategoryById(req, res) {
  const { id } = req.params;
  const builderId = req.user.builder_id;

  const pool = getPool();
  const client = await pool.connect();

  try {
    const result = await client.query(
      `
      SELECT * FROM master_price_list_categories
      WHERE master_price_list_category_id = $1 AND builder_id = $2 AND is_deleted = false
      `,
      [id, builderId],
    );

    if (result.rowCount === 0) {
      return errorResponse(res, 404, "Category not found.");
    }

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Category fetched successfully.",
    );
  } catch (error) {
    console.error("Get category by ID error:", error);
    return errorResponse(res, 500, "Failed to fetch category.");
  } finally {
    client.release();
  }
}

export async function createMasterPriceListCategory(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const createdBy = req.user?.user_id;
    const { name, description } = req.body;

    if (!builderId || !companyId) {
      return errorResponse(res, 400, "Builder ID and Company ID are required.");
    }

    if (!name || name.trim() === "") {
      return errorResponse(res, 400, "Category name is required.");
    }

    const orderResult = await client.query(
      `
      SELECT COALESCE(MAX(display_order), 0) + 1 AS next_order
      FROM master_price_list_categories
      WHERE builder_id = $1 AND company_id = $2
      `,
      [builderId, companyId],
    );

    const displayOrder = orderResult.rows[0].next_order;

    const insertQuery = `
      INSERT INTO master_price_list_categories 
        (company_id, builder_id, name, description, display_order, created_by, updated_by)
      VALUES ($1, $2, $3, $4, $5, $6, $6)
      RETURNING *
    `;

    const insertValues = [
      companyId,
      builderId,
      name.trim(),
      description || null,
      displayOrder,
      createdBy || null,
    ];

    const result = await client.query(insertQuery, insertValues);

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Category created successfully.",
    );
  } catch (error) {
    console.error("Create category error:", error);
    return errorResponse(res, 500, "Failed to create category.");
  } finally {
    client.release();
  }
}

export async function updateMasterPriceListCategory(req, res) {
  const { id } = req.params;
  const { name, description } = req.body;

  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const updatedBy = req.user?.user_id;

    if (!id) {
      return errorResponse(res, 400, "Category ID is required.");
    }

    if (!builderId || !companyId) {
      return errorResponse(res, 400, "Builder ID and Company ID are required.");
    }

    const existingCategory = await client.query(
      `
      SELECT * 
      FROM master_price_list_categories
      WHERE master_price_list_category_id = $1
        AND builder_id = $2
        AND company_id = $3
        AND is_deleted = false
      `,
      [id, builderId, companyId],
    );

    if (existingCategory.rowCount === 0) {
      return errorResponse(res, 404, "Category not found or already deleted.");
    }

    const updateQuery = `
      UPDATE master_price_list_categories
      SET 
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        updated_by = $3,
        updated_at = NOW()
      WHERE master_price_list_category_id = $4
        AND builder_id = $5
        AND company_id = $6
        AND is_deleted = false
      RETURNING *
    `;

    const updateValues = [
      name ? name.trim() : null,
      description || null,
      updatedBy || null,
      id,
      builderId,
      companyId,
    ];

    const result = await client.query(updateQuery, updateValues);

    if (result.rowCount === 0) {
      return errorResponse(res, 404, "Category not found or already deleted.");
    }

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Category updated successfully.",
    );
  } catch (error) {
    console.error("Update category error:", error);
    return errorResponse(res, 500, "Failed to update category.");
  } finally {
    client.release();
  }
}

export async function displayOrderManage(req, res) {
  const { orderedCategories } = req.body;
  const builderId = req.user?.builder_id;
  const companyId = req.user?.company_id;
  const updatedBy = req.user?.user_id;

  const pool = getPool();
  const client = await pool.connect();

  try {
    if (!Array.isArray(orderedCategories) || orderedCategories.length === 0) {
      return errorResponse(
        res,
        400,
        "orderedCategories must be a non-empty array.",
      );
    }

    if (!builderId || !companyId) {
      return errorResponse(res, 400, "Builder ID and Company ID are required.");
    }

    await client.query("BEGIN");

    // Extract category IDs from body
    const categoryIds = orderedCategories.map((c) => c.categoryId);

    // Check if all category IDs exist and belong to this builder/company
    const { rows: existingCategories } = await client.query(
      `
      SELECT master_price_list_category_id
      FROM master_price_list_categories
      WHERE builder_id = $1
        AND company_id = $2
        AND is_deleted = false
        AND master_price_list_category_id = ANY($3::uuid[])
      `,
      [builderId, companyId, categoryIds],
    );

    const validIds = existingCategories.map(
      (c) => c.master_price_list_category_id,
    );

    const invalidIds = categoryIds.filter((id) => !validIds.includes(id));

    if (invalidIds.length > 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        `Invalid or deleted category IDs: ${invalidIds.join(", ")}`,
      );
    }

    const cases = [];
    const values = [builderId, companyId];
    let i = 3;

    for (const { categoryId, displayOrder } of orderedCategories) {
      cases.push(
        `WHEN master_price_list_category_id = $${i} THEN $${i + 1}::int`,
      );
      values.push(categoryId, Number(displayOrder));
      i += 2;
    }

    const updateQuery = `
      UPDATE master_price_list_categories
      SET 
        display_order = CASE ${cases.join(" ")} END,
        updated_by = $${i},
        updated_at = NOW()
      WHERE builder_id = $1
        AND company_id = $2
        AND master_price_list_category_id = ANY($${i + 1}::uuid[])
      RETURNING *;
    `;

    values.push(updatedBy || null, categoryIds);

    const { rows: updatedRows } = await client.query(updateQuery, values);
    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(updatedRows),
      "Category display orders updated successfully.",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error updating display order:", error);
    return errorResponse(
      res,
      500,
      error?.message || "Failed to update category display orders.",
    );
  } finally {
    client.release();
  }
}

export async function deleteMasterPriceListCategory(req, res) {
  const { id } = req.params;
  const builderId = req.user.builder_id;

  const pool = getPool();
  const client = await pool.connect();

  try {
    const checkCategoryExists = await client.query(
      "SELECT * FROM master_price_list_categories WHERE master_price_list_category_id = $1 AND builder_id = $2 AND is_deleted = false",
      [id, builderId],
    );

    if (checkCategoryExists.rowCount === 0) {
      return errorResponse(res, 404, "Category not found or already deleted.");
    }

    const result = await client.query(
      `
      UPDATE master_price_list_categories
      SET is_deleted = true
      WHERE master_price_list_category_id = $1 AND builder_id = $2
      RETURNING *
      `,
      [id, builderId],
    );

    if (result.rowCount === 0) {
      return errorResponse(res, 404, "Category not found or already deleted.");
    }

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Category deleted successfully.",
    );
  } catch (error) {
    console.error("Delete category error:", error);
    return errorResponse(res, 500, "Failed to delete category.");
  } finally {
    client.release();
  }
}
