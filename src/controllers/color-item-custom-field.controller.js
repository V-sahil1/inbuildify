const getPool = require("../config/database");
const { successResponse, errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.createColorItemCustomField = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId || !companyId) {
      return errorResponse(res, 401, "Unauthorized.");
    }

    const { color_item, field_type, field_name, required_field, sort_order } =
      req.body;

    if (!color_item) {
      return errorResponse(res, 400, "Color Item ID is required.");
    }

    if (!field_name || field_name.trim() === "") {
      return errorResponse(res, 400, "Field name is required.");
    }

    let finalSortOrder = sort_order || 1;

    await client.query("BEGIN");

    const colorItemCheck = await client.query(
      `SELECT color_item_id FROM color_item 
       WHERE color_item_id = $1 AND (
         (company_id = $2 AND company_id IS NOT NULL) OR 
         (builder_id = $3 AND builder_id IS NOT NULL)
       ) LIMIT 1`,
      [color_item, companyId, builderId],
    );

    if (colorItemCheck.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "Invalid color item ID or color item not found in your scope.",
      );
    }

    const shiftFieldsQuery = `
      UPDATE color_item_custom_field 
      SET sort_order = sort_order + 1 
      WHERE color_item = $1 
        AND sort_order >= $2
    `;
    await client.query(shiftFieldsQuery, [color_item, finalSortOrder]);

    const duplicateCheck = await client.query(
      `
      SELECT 1
      FROM color_item_custom_field
      WHERE color_item = $1
        AND LOWER(field_name) = LOWER($2)
      `,
      [color_item, field_name.trim()],
    );

    if (duplicateCheck.rowCount > 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        409,
        "Field with this name already exists for this color item.",
      );
    }

    const insertQuery = `
      INSERT INTO color_item_custom_field (
        color_item, field_type, field_name, required_field, sort_order
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;

    const values = [
      color_item,
      field_type,
      field_name.trim(),
      required_field !== undefined ? required_field : false,
      finalSortOrder,
    ];

    const result = await client.query(insertQuery, values);
    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Color item custom field created successfully.",
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error creating color item custom field:", err);
    return errorResponse(res, 400, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.getColorItemCustomFields = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const { color_item, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    if (!builderId || !companyId) {
      return errorResponse(res, 401, "Unauthorized.");
    }

    let whereClause = `
      WHERE cf.color_item IN (
        SELECT color_item_id FROM color_item 
        WHERE (company_id = $1 AND company_id IS NOT NULL) OR 
              (builder_id = $2 AND builder_id IS NOT NULL)
      )
    `;
    const queryParams = [companyId, builderId];
    let paramIndex = 3;

    if (color_item) {
      whereClause += ` AND cf.color_item = $${paramIndex}`;
      queryParams.push(color_item);
      paramIndex++;
    }

    const query = `
      SELECT cf.*, 
             ci.item_name as color_item_name
      FROM color_item_custom_field cf
      LEFT JOIN color_item ci ON cf.color_item = ci.color_item_id
      ${whereClause}
      ORDER BY cf.sort_order ASC, cf.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1};
    `;

    queryParams.push(limit, offset);

    const countQuery = `
      SELECT COUNT(*) as total 
      FROM color_item_custom_field cf
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
        colorItemCustomFields: keysToCamelCase(result.rows),
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          total,
          limit: parseInt(limit),
        },
      },
      "Color item custom fields fetched successfully.",
    );
  } catch (err) {
    console.error("Error fetching color item custom fields:", err);
    return errorResponse(res, 500, "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.getColorItemCustomFieldById = async (req, res) => {
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
      SELECT cf.*, 
             ci.item_name as color_item_name
      FROM color_item_custom_field cf
      LEFT JOIN color_item ci ON cf.color_item = ci.color_item_id
      WHERE cf.color_item_custom_field_id = $1 
        AND (ci.company_id = $2 OR ci.builder_id = $3)
      LIMIT 1;
    `;

    const result = await client.query(query, [id, companyId, builderId]);

    if (result.rowCount === 0) {
      return errorResponse(res, 404, "Color item custom field not found.");
    }

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Color item custom field fetched successfully.",
    );
  } catch (err) {
    console.error("Error fetching color item custom field:", err);
    return errorResponse(res, 500, "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.updateColorItemCustomField = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { color_item, field_type, field_name, required_field, sort_order } =
      req.body;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId || !companyId) {
      return errorResponse(res, 401, "Unauthorized.");
    }

    await client.query("BEGIN");

    const existingFieldQuery = `
      SELECT cf.color_item_custom_field_id, cf.field_name, cf.sort_order, cf.color_item,
             ci.company_id, ci.builder_id
      FROM color_item_custom_field cf
      LEFT JOIN color_item ci ON cf.color_item = ci.color_item_id
      WHERE cf.color_item_custom_field_id = $1 
        AND (ci.company_id = $2 OR ci.builder_id = $3)
      LIMIT 1
    `;
    const existingFieldResult = await client.query(existingFieldQuery, [
      id,
      companyId,
      builderId,
    ]);

    if (existingFieldResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Color item custom field not found.");
    }

    const existingField = existingFieldResult.rows[0];
    const updatedSortOrder =
      sort_order !== undefined ? sort_order : existingField.sort_order;

    if (sort_order !== undefined && sort_order !== existingField.sort_order) {
      if (sort_order > existingField.sort_order) {
        const shiftFieldsQuery = `
          UPDATE color_item_custom_field 
          SET sort_order = sort_order - 1 
          WHERE color_item = $1 
            AND sort_order > $2 
            AND sort_order <= $3
            AND color_item_custom_field_id != $4
        `;
        await client.query(shiftFieldsQuery, [
          existingField.color_item,
          existingField.sort_order,
          sort_order,
          id,
        ]);
      } else {
        const shiftFieldsQuery = `
          UPDATE color_item_custom_field 
          SET sort_order = sort_order + 1 
          WHERE color_item = $1 
            AND sort_order >= $2 
            AND sort_order < $3
            AND color_item_custom_field_id != $4
        `;
        await client.query(shiftFieldsQuery, [
          existingField.color_item,
          sort_order,
          existingField.sort_order,
          id,
        ]);
      }
    }

    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;

    if (color_item !== undefined) {
      updateFields.push(`color_item = $${paramIndex}`);
      updateValues.push(color_item);
      paramIndex++;
    }

    if (field_type !== undefined) {
      updateFields.push(`field_type = $${paramIndex}`);
      updateValues.push(field_type);
      paramIndex++;
    }

    if (field_name !== undefined) {
      updateFields.push(`field_name = $${paramIndex}`);
      updateValues.push(field_name);
      paramIndex++;
    }

    if (required_field !== undefined) {
      updateFields.push(`required_field = $${paramIndex}`);
      updateValues.push(required_field);
      paramIndex++;
    }

    if (sort_order !== undefined) {
      updateFields.push(`sort_order = $${paramIndex}`);
      updateValues.push(sort_order);
      paramIndex++;
    }

    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);

    if (updateValues.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "At least one field must be provided for update.",
      );
    }

    const updateQuery = `
      UPDATE color_item_custom_field 
      SET ${updateFields.join(", ")}
      WHERE color_item_custom_field_id = $${paramIndex}
      RETURNING *;
    `;

    updateValues.push(id);

    const result = await client.query(updateQuery, updateValues);
    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Color item custom field updated successfully.",
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error updating color item custom field:", err);
    return errorResponse(res, 400, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.deleteColorItemCustomField = async (req, res) => {
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

    const existingFieldQuery = `
      SELECT cf.color_item_custom_field_id, cf.sort_order, cf.color_item,
             ci.company_id, ci.builder_id
      FROM color_item_custom_field cf
      LEFT JOIN color_item ci ON cf.color_item = ci.color_item_id
      WHERE cf.color_item_custom_field_id = $1 
        AND (ci.company_id = $2 OR ci.builder_id = $3)
      LIMIT 1
    `;
    const existingFieldResult = await client.query(existingFieldQuery, [
      id,
      companyId,
      builderId,
    ]);

    if (existingFieldResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Color item custom field not found.");
    }

    const existingField = existingFieldResult.rows[0];

    const shiftFieldsQuery = `
      UPDATE color_item_custom_field 
      SET sort_order = sort_order - 1 
      WHERE color_item = $1 
        AND sort_order > $2
    `;
    await client.query(shiftFieldsQuery, [
      existingField.color_item,
      existingField.sort_order,
    ]);

    const deleteQuery = `
      DELETE FROM color_item_custom_field WHERE color_item_custom_field_id = $1 RETURNING *;
    `;

    const result = await client.query(deleteQuery, [id]);
    await client.query("COMMIT");

    return successResponse(
      res,
      "Color item custom field deleted successfully.",
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error deleting color item custom field:", err);
    return errorResponse(res, 400, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
};
