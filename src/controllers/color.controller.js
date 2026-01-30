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

    // Shift existing colors to make room for the new sort order
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

    // Check for duplicate color name within the same company/builder scope
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
      SELECT * FROM color 
      WHERE company_id = $1 AND builder_id = $2
      ORDER BY sort_order ASC, created_at DESC
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
          total,
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

    // Get existing color record
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

    // Handle sort order shifting if sort_order is being updated
    if (sort_order !== undefined && sort_order !== existingColor.sort_order) {
      if (sort_order > existingColor.sort_order) {
        // Moving down: decrement sort orders of items in between
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
        // Moving up: increment sort orders of items in between
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

    // Get existing color record before deletion
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

    // Shift remaining colors to fill the gap
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

    // Delete the color
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
