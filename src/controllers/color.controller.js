const getPool = require("../config/database");
const { successResponse, errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.createColor = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.users_id;

    if (!builderId || !companyId) {
      return errorResponse(res, 401, "Unauthorized.");
    }

    const { color_name, sort_order, status } = req.body;

    if (!color_name || color_name.trim() === "") {
      return errorResponse(res, 400, "Color name is required.");
    }

    let finalSortOrder = sort_order || 1;

    await client.query("BEGIN");

    const shiftColorsQuery = `
      UPDATE color 
      SET sort_order = sort_order + 1 
      WHERE company_id = $1 
        AND builder_id = $2 
        AND sort_order >= $3
    `;
    await client.query(shiftColorsQuery, [
      companyId,
      builderId,
      finalSortOrder,
    ]);

    const duplicateCheck = await client.query(
      `
      SELECT 1
      FROM color
      WHERE company_id = $1
        AND builder_id = $2
        AND LOWER(color_name) = LOWER($3)
      `,
      [companyId, builderId, color_name.trim()],
    );

    if (duplicateCheck.rowCount > 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 409, "Color with this name already exists.");
    }

    const insertQuery = `
      INSERT INTO color (
        company_id, builder_id, color_name, sort_order, status, created_by, updated_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
    `;

    const values = [
      companyId,
      builderId,
      color_name.trim(),
      finalSortOrder,
      status !== undefined ? status : true,
      userId,
      userId,
    ];

    const result = await client.query(insertQuery, values);
    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Color created successfully.",
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error creating color:", err);
    return errorResponse(res, 400, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.getColors = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    if (!builderId || !companyId) {
      return errorResponse(res, 401, "Unauthorized.");
    }

    const query = `
      SELECT 
        c.color_id,
        c.company_id,
        c.builder_id,
        c.color_name,
        c.sort_order,
        c.status,
        c.created_at,
        c.updated_at
      FROM color c
      WHERE c.company_id = $1 AND c.builder_id = $2
      ORDER BY c.sort_order ASC, c.created_at 
      LIMIT $3 OFFSET $4;
    `;

    const countQuery = `
      SELECT COUNT(*) as total FROM color 
      WHERE company_id = $1 AND builder_id = $2;
    `;

    const [result, countResult] = await Promise.all([
      client.query(query, [companyId, builderId, limit, offset]),
      client.query(countQuery, [companyId, builderId]),
    ]);

    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);

    return successResponse(
      res,
      {
        colors: keysToCamelCase(result.rows),
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalRecords: total,
          limit: parseInt(limit),
        },
      },
      "Colors fetched successfully.",
    );
  } catch (err) {
    console.error("Error fetching colors:", err);
    return errorResponse(res, 500, "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.getColorById = async (req, res) => {
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
      SELECT * FROM color 
      WHERE color_id = $1 AND builder_id = $2 AND company_id = $3 
      LIMIT 1;
    `;

    const result = await client.query(query, [id, builderId, companyId]);

    if (result.rowCount === 0) {
      return errorResponse(res, 404, "Color not found.");
    }

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Color fetched successfully.",
    );
  } catch (err) {
    console.error("Error fetching color:", err);
    return errorResponse(res, 500, "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.updateColor = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { color_name, sort_order, status } = req.body;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.users_id;

    await client.query("BEGIN");

    const existingColorQuery = `
      SELECT color_id, color_name, sort_order, company_id, builder_id 
      FROM color 
      WHERE color_id = $1 AND builder_id = $2 AND company_id = $3 LIMIT 1
    `;
    const existingColorResult = await client.query(existingColorQuery, [
      id,
      builderId,
      companyId,
    ]);

    if (existingColorResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Color not found.");
    }

    const existingColor = existingColorResult.rows[0];
    const updatedSortOrder =
      sort_order !== undefined ? sort_order : existingColor.sort_order;

    if (sort_order !== undefined && sort_order !== existingColor.sort_order) {
      if (sort_order > existingColor.sort_order) {
        const shiftColorsQuery = `
          UPDATE color 
          SET sort_order = sort_order - 1 
          WHERE company_id = $1 
            AND builder_id = $2 
            AND sort_order > $3 
            AND sort_order <= $4
            AND color_id != $5
        `;
        await client.query(shiftColorsQuery, [
          existingColor.company_id,
          existingColor.builder_id,
          existingColor.sort_order,
          sort_order,
          id,
        ]);
      } else {
        const shiftColorsQuery = `
          UPDATE color 
          SET sort_order = sort_order + 1 
          WHERE company_id = $1 
            AND builder_id = $2 
            AND sort_order >= $3 
            AND sort_order < $4
            AND color_id != $5
        `;
        await client.query(shiftColorsQuery, [
          existingColor.company_id,
          existingColor.builder_id,
          sort_order,
          existingColor.sort_order,
          id,
        ]);
      }
    }

    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;

    if (color_name !== undefined) {
      updateFields.push(`color_name = $${paramIndex}`);
      updateValues.push(color_name);
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

    updateFields.push(`updated_by = $${paramIndex}`);
    updateValues.push(userId);
    paramIndex++;

    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);

    if (updateValues.length === 1) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "At least one field must be provided for update.",
      );
    }

    const updateQuery = `
      UPDATE color 
      SET ${updateFields.join(", ")}
      WHERE color_id = $${paramIndex}
      RETURNING *;
    `;

    updateValues.push(id);

    const result = await client.query(updateQuery, updateValues);
    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Color updated successfully.",
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error updating color:", err);
    return errorResponse(res, 400, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.deleteColor = async (req, res) => {
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

    const existingColorQuery = `
      SELECT color_id, sort_order, company_id, builder_id 
      FROM color 
      WHERE color_id = $1 AND builder_id = $2 AND company_id = $3 
      LIMIT 1
    `;
    const existingColorResult = await client.query(existingColorQuery, [
      id,
      builderId,
      companyId,
    ]);

    if (existingColorResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Color not found.");
    }

    const existingColor = existingColorResult.rows[0];

    const shiftColorsQuery = `
      UPDATE color 
      SET sort_order = sort_order - 1 
      WHERE company_id = $1 
        AND builder_id = $2 
        AND sort_order > $3
    `;
    await client.query(shiftColorsQuery, [
      existingColor.company_id,
      existingColor.builder_id,
      existingColor.sort_order,
    ]);

    const deleteQuery = `
      DELETE FROM color WHERE color_id = $1 RETURNING *;
    `;

    const result = await client.query(deleteQuery, [id]);
    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Color deleted successfully.",
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error deleting color:", err);
    return errorResponse(res, 400, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.copyColor = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.users_id;
    const { color_id } = req.params;
    const { color_name, sort_order } = req.body;

    if (!builderId || !companyId) {
      return errorResponse(res, 401, "Unauthorized.");
    }

    if (!color_id) {
      return errorResponse(res, 400, "Color ID is required.");
    }

    if (!color_name || color_name.trim() === "") {
      return errorResponse(res, 400, "Color name is required.");
    }

    await client.query("BEGIN");

    const sourceColorQuery = `
      SELECT * FROM color 
      WHERE color_id = $1 
        AND (company_id = $2 OR builder_id = $3)
    `;
    const sourceColorResult = await client.query(sourceColorQuery, [
      color_id,
      companyId,
      builderId,
    ]);

    if (sourceColorResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Source color not found.");
    }

    const duplicateCheck = await client.query(
      `
      SELECT 1
      FROM color
      WHERE company_id = $1
        AND builder_id = $2
        AND LOWER(color_name) = LOWER($3)
      `,
      [companyId, builderId, color_name.trim()],
    );

    if (duplicateCheck.rowCount > 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 409, "Color with this name already exists.");
    }

    const colorCountQuery = `
      SELECT COUNT(*) as total_colors
      FROM color
      WHERE company_id = $1 OR builder_id = $2
    `;
    const colorCountResult = await client.query(colorCountQuery, [
      companyId,
      builderId,
    ]);

    const totalColors = parseInt(colorCountResult.rows[0].total_colors);
    const maxAllowedSortOrder = totalColors + 1;

    if (sort_order && sort_order > maxAllowedSortOrder) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        `Sort order cannot be more than ${maxAllowedSortOrder}. Current total colors: ${totalColors}`,
      );
    }

    let finalSortOrder = sort_order || maxAllowedSortOrder;

    const shiftColorsQuery = `
      UPDATE color 
      SET sort_order = sort_order + 1 
      WHERE company_id = $1 
        AND builder_id = $2 
        AND sort_order >= $3
    `;
    await client.query(shiftColorsQuery, [
      companyId,
      builderId,
      finalSortOrder,
    ]);

    // Create the new color
    const newColorQuery = `
      INSERT INTO color (
        company_id, builder_id, color_name, sort_order, status, 
        created_by, updated_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    const newColorResult = await client.query(newColorQuery, [
      companyId,
      builderId,
      color_name.trim(),
      finalSortOrder,
      true,
      userId,
      userId,
    ]);

    const newColorId = newColorResult.rows[0].color_id;

    const colorCategoriesQuery = `
      SELECT * FROM color_category 
      WHERE color_id = $1
      ORDER BY sort_order
    `;
    const colorCategoriesResult = await client.query(colorCategoriesQuery, [
      color_id,
    ]);

    const categoryMapping = {}; // Map old category IDs to new ones

    for (const category of colorCategoriesResult.rows) {
      const newCategoryQuery = `
        INSERT INTO color_category (
          color_id, category_name, selection_type, sort_order, status,
          suppliers, color_group, created_by, updated_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING color_category_id
      `;
      const newCategoryResult = await client.query(newCategoryQuery, [
        newColorId,
        category.category_name,
        category.selection_type,
        category.sort_order,
        category.status,
        category.suppliers,
        category.color_group,
        userId,
        userId,
      ]);

      categoryMapping[category.color_category_id] =
        newCategoryResult.rows[0].color_category_id;
    }

    const colorItemsQuery = `
      SELECT * FROM color_item 
      WHERE color_category_id = ANY($1)
    `;
    const colorItemsResult = await client.query(colorItemsQuery, [
      Object.keys(categoryMapping),
    ]);

    for (const item of colorItemsResult.rows) {
      const newCategoryId = categoryMapping[item.color_category_id];

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
      keysToCamelCase(newColorResult.rows[0]),
      "Color copied successfully with all categories and items.",
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error copying color:", err);
    return errorResponse(res, 500, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
};
