import getPool from "../../config/database.js";
import { successResponse, errorResponse } from "../../helper/response.js";
import { keysToCamelCase } from "../../utils/common.js";

export async function createColorCategory(req, res) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.users_id;

    if (!builderId || !companyId) {
      return errorResponse(res, 401, "Unauthorized.");
    }

    const {
      color_id,
      category_name,
      selection_type,
      sort_order,
      status,
      suppliers,
      color_group,
    } = req.body;

    if (!color_id) {
      return errorResponse(res, 400, "Color ID is required.");
    }

    if (!category_name || category_name.trim() === "") {
      return errorResponse(res, 400, "Category name is required.");
    }

    const finalSortOrder = sort_order || 1;

    await client.query("BEGIN");

    const colorCheck = await client.query(
      "SELECT color_id FROM color WHERE color_id = $1 AND builder_id = $2 AND company_id = $3 AND status = true LIMIT 1",
      [color_id, builderId, companyId],
    );

    if (colorCheck.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "Invalid color ID or color not found or inactive..",
      );
    }

    const shiftCategoriesQuery = `
      UPDATE color_category 
      SET sort_order = sort_order + 1 
      WHERE color_id = $1 
        AND sort_order >= $2
    `;
    await client.query(shiftCategoriesQuery, [color_id, finalSortOrder]);

    const duplicateCheck = await client.query(
      `
      SELECT 1
      FROM color_category
      WHERE color_id = $1
        AND LOWER(category_name) = LOWER($2)
      `,
      [color_id, category_name.trim()],
    );

    if (duplicateCheck.rowCount > 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        409,
        "Category with this name already exists for this color.",
      );
    }

    // Validate suppliers array if provided
    if (suppliers && suppliers.length > 0) {
      const supplierCheck = await client.query(
        "SELECT supplier_id FROM supplier WHERE supplier_id = ANY($1::uuid[]) AND company_id = $2 AND builder_id = $3 AND status = true",
        [suppliers, companyId, builderId],
      );

      if (supplierCheck.rowCount !== suppliers.length) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "One or more supplier IDs are invalid or not in your scope.",
        );
      }
    }

    // Validate color_group array if provided
    if (color_group && color_group.length > 0) {
      const colorGroupCheck = await client.query(
        "SELECT color_group_id FROM color_group WHERE color_group_id = ANY($1::uuid[]) AND company_id = $2 AND builder_id = $3 AND status = true",
        [color_group, companyId, builderId],
      );

      if (colorGroupCheck.rowCount !== color_group.length) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "One or more color group IDs are invalid or not in your scope.",
        );
      }
    }

    const insertQuery = `
      INSERT INTO color_category (
        color_id, category_name, selection_type, sort_order, status, 
        suppliers, color_group, created_by, updated_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *;
    `;

    const values = [
      color_id,
      category_name.trim(),
      selection_type || "multiple",
      finalSortOrder,
      status !== undefined ? status : true,
      suppliers || [],
      color_group || [],
      userId,
      userId,
    ];

    const result = await client.query(insertQuery, values);
    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Color category created successfully.",
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error creating color category:", err);
    return errorResponse(res, 400, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
}

export async function getColorCategories(req, res) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const { color_id, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    if (!builderId || !companyId) {
      return errorResponse(res, 401, "Unauthorized.");
    }

    let whereClause =
      "WHERE c.color_id IN (SELECT color_id FROM color WHERE builder_id = $1 AND company_id = $2)";
    const queryParams = [builderId, companyId];
    let paramIndex = 3;

    if (color_id) {
      whereClause += ` AND c.color_id = $${paramIndex}`;
      queryParams.push(color_id);
      paramIndex++;
    }

    const query = `
      SELECT c.*, 
             col.color_name as color_name
      FROM color_category c
      LEFT JOIN color col ON c.color_id = col.color_id
      ${whereClause}
      ORDER BY c.sort_order ASC, c.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1};
    `;

    queryParams.push(limit, offset);

    const countQuery = `
      SELECT COUNT(*) as total 
      FROM color_category c
      ${whereClause};
    `;

    const [result, countResult] = await Promise.all([
      client.query(query, queryParams),
      client.query(countQuery, queryParams.slice(0, -2)),
    ]);

    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);

    return successResponse(
      res,
      {
        colorCategories: keysToCamelCase(result.rows),
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          total,
          limit: parseInt(limit),
        },
      },
      "Color categories fetched successfully.",
    );
  } catch (err) {
    console.error("Error fetching color categories:", err);
    return errorResponse(res, 500, "Internal Server Error");
  } finally {
    client.release();
  }
}

export async function getColorCategoryById(req, res) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId || !companyId) {
      return errorResponse(res, 401, "Unauthorized.");
    }

    const query = `
      SELECT c.*, 
             col.color_name as color_name
      FROM color_category c
      LEFT JOIN color col ON c.color_id = col.color_id
      WHERE c.color_category_id = $1 
        AND col.builder_id = $2 
        AND col.company_id = $3
      LIMIT 1;
    `;

    const result = await client.query(query, [id, builderId, companyId]);

    if (result.rowCount === 0) {
      return errorResponse(res, 404, "Color category not found.");
    }

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Color category fetched successfully.",
    );
  } catch (err) {
    console.error("Error fetching color category:", err);
    return errorResponse(res, 500, "Internal Server Error");
  } finally {
    client.release();
  }
}

export async function updateColorCategory(req, res) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const {
      category_name,
      selection_type,
      sort_order,
      status,
      suppliers,
      color_group,
    } = req.body;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.users_id;

    if (!builderId || !companyId) {
      return errorResponse(res, 401, "Unauthorized.");
    }

    await client.query("BEGIN");

    const existingCategoryQuery = `
      SELECT cc.color_category_id, cc.category_name, cc.sort_order, cc.color_id,
             col.builder_id, col.company_id
      FROM color_category cc
      LEFT JOIN color col ON cc.color_id = col.color_id
      WHERE cc.color_category_id = $1 
        AND col.builder_id = $2 
        AND col.company_id = $3
      LIMIT 1
    `;
    const existingCategoryResult = await client.query(existingCategoryQuery, [
      id,
      builderId,
      companyId,
    ]);

    if (existingCategoryResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Color category not found.");
    }

    const existingCategory = existingCategoryResult.rows[0];
    const updatedSortOrder =
      sort_order !== undefined ? sort_order : existingCategory.sort_order;

    if (
      sort_order !== undefined &&
      sort_order !== existingCategory.sort_order
    ) {
      if (sort_order > existingCategory.sort_order) {
        const shiftCategoriesQuery = `
          UPDATE color_category 
          SET sort_order = sort_order - 1 
          WHERE color_id = $1 
            AND sort_order > $2 
            AND sort_order <= $3
            AND color_category_id != $4
        `;
        await client.query(shiftCategoriesQuery, [
          existingCategory.color_id,
          existingCategory.sort_order,
          sort_order,
          id,
        ]);
      } else {
        const shiftCategoriesQuery = `
          UPDATE color_category 
          SET sort_order = sort_order + 1 
          WHERE color_id = $1 
            AND sort_order >= $2 
            AND sort_order < $3
            AND color_category_id != $4
        `;
        await client.query(shiftCategoriesQuery, [
          existingCategory.color_id,
          sort_order,
          existingCategory.sort_order,
          id,
        ]);
      }
    }

    if (suppliers && suppliers.length > 0) {
      const supplierCheck = await client.query(
        "SELECT supplier_id FROM supplier WHERE supplier_id = ANY($1::uuid[]) AND company_id = $2 AND builder_id = $3",
        [suppliers, companyId, builderId],
      );

      if (supplierCheck.rowCount !== suppliers.length) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "One or more supplier IDs are invalid or not in your scope.",
        );
      }
    }

    if (color_group && color_group.length > 0) {
      const colorGroupCheck = await client.query(
        "SELECT color_group_id FROM color_group WHERE color_group_id = ANY($1::uuid[]) AND company_id = $2 AND builder_id = $3 AND status = true",
        [color_group, companyId, builderId],
      );

      if (colorGroupCheck.rowCount !== color_group.length) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "One or more color group IDs are invalid or not in your scope.",
        );
      }
    }

    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;

    if (category_name !== undefined) {
      updateFields.push(`category_name = $${paramIndex}`);
      updateValues.push(category_name);
      paramIndex++;
    }

    if (selection_type !== undefined) {
      updateFields.push(`selection_type = $${paramIndex}`);
      updateValues.push(selection_type);
      paramIndex++;
    }

    if (sort_order !== undefined) {
      updateFields.push(`sort_order = $${paramIndex}`);
      updateValues.push(sort_order);
      paramIndex++;
    }

    if (status !== undefined) {
      updateFields.push(`status = $${paramIndex}`);
      updateValues.push(status);
      paramIndex++;
    }

    if (suppliers !== undefined) {
      updateFields.push(`suppliers = $${paramIndex}`);
      updateValues.push(suppliers);
      paramIndex++;
    }

    if (color_group !== undefined) {
      updateFields.push(`color_group = $${paramIndex}`);
      updateValues.push(color_group);
      paramIndex++;
    }

    updateFields.push(`updated_by = $${paramIndex}`);
    updateValues.push(userId);
    paramIndex++;

    updateFields.push("updated_at = CURRENT_TIMESTAMP");

    if (updateValues.length === 1) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "At least one field must be provided for update.",
      );
    }

    const updateQuery = `
      UPDATE color_category 
      SET ${updateFields.join(", ")}
      WHERE color_category_id = $${paramIndex}
      RETURNING *;
    `;

    updateValues.push(id);

    const result = await client.query(updateQuery, updateValues);
    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Color category updated successfully.",
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error updating color category:", err);
    return errorResponse(res, 400, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
}

export async function getColorCategoriesByColorId(req, res) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { id } = req.params; // This will be color_id
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId || !companyId) {
      return errorResponse(res, 401, "Unauthorized.");
    }

    // First verify the color exists and belongs to the user
    const colorCheck = await client.query(
      "SELECT color_id FROM color WHERE color_id = $1 AND builder_id = $2 AND company_id = $3 AND status = true LIMIT 1",
      [id, builderId, companyId],
    );

    if (colorCheck.rowCount === 0) {
      return errorResponse(res, 404, "Color not found or inactive.");
    }

    const query = `
      SELECT c.*, 
             col.color_name as color_name
      FROM color_category c
      LEFT JOIN color col ON c.color_id = col.color_id
      WHERE c.color_id = $1 
        AND col.builder_id = $2 
        AND col.company_id = $3
      ORDER BY c.sort_order ASC, c.created_at DESC;
    `;

    const result = await client.query(query, [id, builderId, companyId]);

    return successResponse(
      res,
      keysToCamelCase(result.rows),
      "Color categories fetched successfully.",
    );
  } catch (err) {
    console.error("Error fetching color categories by color ID:", err);
    return errorResponse(res, 500, "Internal Server Error");
  } finally {
    client.release();
  }
}

export async function deleteColorCategory(req, res) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId || !companyId) {
      return errorResponse(res, 401, "Unauthorized.");
    }

    await client.query("BEGIN");

    const existingCategoryQuery = `
      SELECT cc.color_category_id, cc.sort_order, cc.color_id,
             col.builder_id, col.company_id
      FROM color_category cc
      LEFT JOIN color col ON cc.color_id = col.color_id
      WHERE cc.color_category_id = $1 
        AND col.builder_id = $2 
        AND col.company_id = $3
      LIMIT 1
    `;
    const existingCategoryResult = await client.query(existingCategoryQuery, [
      id,
      builderId,
      companyId,
    ]);

    if (existingCategoryResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Color category not found.");
    }

    const existingCategory = existingCategoryResult.rows[0];

    const shiftCategoriesQuery = `
      UPDATE color_category 
      SET sort_order = sort_order - 1 
      WHERE color_id = $1 
        AND sort_order > $2
    `;
    await client.query(shiftCategoriesQuery, [
      existingCategory.color_id,
      existingCategory.sort_order,
    ]);

    const deleteQuery = `
      DELETE FROM color_category WHERE color_category_id = $1 RETURNING *;
    `;

    const result = await client.query(deleteQuery, [id]);
    await client.query("COMMIT");

    return successResponse(res, "Color category deleted successfully.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error deleting color category:", err);
    return errorResponse(res, 400, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
}

export async function copyColorCategory(req, res) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.users_id;
    const { id: source_category_id } = req.params;
    const { color_id, category_name, sort_order } = req.body;

    if (!builderId || !companyId) {
      return errorResponse(res, 401, "Unauthorized.");
    }

    if (!source_category_id) {
      return errorResponse(res, 400, "Source category ID is required.");
    }

    if (!color_id) {
      return errorResponse(res, 400, "Target color ID is required.");
    }

    if (!category_name || category_name.trim() === "") {
      return errorResponse(res, 400, "Category name is required.");
    }

    await client.query("BEGIN");

    const sourceCategoryQuery = `
      SELECT cc.*, c.color_name 
      FROM color_category cc
      JOIN color c ON cc.color_id = c.color_id
      WHERE cc.color_category_id = $1 
        AND (c.builder_id = $2 OR c.company_id = $3)
        AND c.status = true 
        AND cc.status = true
      LIMIT 1
    `;
    const sourceCategoryResult = await client.query(sourceCategoryQuery, [
      source_category_id,
      builderId,
      companyId,
    ]);

    if (sourceCategoryResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Source category not found or inactive.");
    }

    const targetColorCheck = await client.query(
      "SELECT color_id FROM color WHERE color_id = $1 AND builder_id = $2 AND company_id = $3 AND status = true LIMIT 1",
      [color_id, builderId, companyId],
    );

    if (targetColorCheck.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Target color not found or inactive.");
    }

    const categoryCountQuery = `
      SELECT COUNT(*) as total_categories
      FROM color_category
      WHERE color_id = $1
    `;
    const categoryCountResult = await client.query(categoryCountQuery, [
      color_id,
    ]);

    const totalCategories = parseInt(
      categoryCountResult.rows[0].total_categories,
    );
    const maxAllowedSortOrder = totalCategories + 1;

    if (sort_order && sort_order > maxAllowedSortOrder) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        `Sort order cannot be more than ${maxAllowedSortOrder}. Current total categories: ${totalCategories}`,
      );
    }

    const finalSortOrder = sort_order || maxAllowedSortOrder;

    const duplicateCategoryCheck = await client.query(
      `
      SELECT 1
      FROM color_category
      WHERE color_id = $1
        AND LOWER(category_name) = LOWER($2)
      `,
      [color_id, category_name.trim()],
    );

    if (duplicateCategoryCheck.rowCount > 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        409,
        "Category with this name already exists in this color.",
      );
    }

    const shiftCategoriesQuery = `
      UPDATE color_category 
      SET sort_order = sort_order + 1 
      WHERE color_id = $1 
        AND sort_order >= $2
    `;
    await client.query(shiftCategoriesQuery, [color_id, finalSortOrder]);

    // Create new category
    const newCategoryQuery = `
      INSERT INTO color_category (
        color_id, category_name, selection_type, sort_order, status,
        suppliers, color_group, created_by, updated_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;
    const newCategoryResult = await client.query(newCategoryQuery, [
      color_id,
      category_name.trim(),
      sourceCategoryResult.rows[0].selection_type || "multiple",
      finalSortOrder,
      true,
      sourceCategoryResult.rows[0].suppliers || [],
      sourceCategoryResult.rows[0].color_group || [],
      userId,
      userId,
    ]);

    const newCategoryId = newCategoryResult.rows[0].color_category_id;

    const colorItemsQuery = `
      SELECT * FROM color_item 
      WHERE color_category_id = $1
    `;
    const colorItemsResult = await client.query(colorItemsQuery, [
      source_category_id,
    ]);

    for (const item of colorItemsResult.rows) {
      const newItemQuery = `
        INSERT INTO color_item (
          company_id, builder_id, color_category_id, item_name, item_code,
          supplier_id, upgrade_option, cost_type, cost, features, description,
          specification_name, units, color_image, specification, sort_order,
          color_type_id, range_id, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
        RETURNING color_item_id
      `;
      const newItemResult = await client.query(newItemQuery, [
        companyId,
        builderId,
        newCategoryId,
        item.item_name,
        item.item_code,
        item.supplier_id,
        item.upgrade_option,
        item.cost_type,
        item.cost,
        item.features,
        item.description,
        item.specification_name,
        item.units,
        item.color_image,
        item.specification,
        item.sort_order,
        item.color_type_id,
        item.range_id,
        item.status,
      ]);

      const newColorItemId = newItemResult.rows[0].color_item_id;

      // Copy custom fields for this color item
      const customFieldsQuery = `
        SELECT * FROM color_item_custom_field 
        WHERE color_item = $1
        ORDER BY sort_order
      `;
      const customFieldsResult = await client.query(customFieldsQuery, [
        item.color_item_id,
      ]);

      for (const customField of customFieldsResult.rows) {
        const newCustomFieldQuery = `
          INSERT INTO color_item_custom_field (
            color_item, field_type, field_name, required_field, sort_order
          ) VALUES ($1, $2, $3, $4, $5)
        `;
        await client.query(newCustomFieldQuery, [
          newColorItemId,
          customField.field_type,
          customField.field_name,
          customField.required_field,
          customField.sort_order,
        ]);
      }
    }

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(newCategoryResult.rows[0]),
      "Color category copied successfully with all items.",
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error copying color category:", err);
    return errorResponse(res, 500, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
}
