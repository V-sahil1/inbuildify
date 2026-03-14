const getPool = require("../../config/database");
const { successResponse, errorResponse } = require("../../helper/response");
const { keysToCamelCase } = require("../../utils/common");

exports.createColorType = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.users_id;
    const { color_type_name } = req.body;

    if (!builderId || !companyId) {
      return errorResponse(res, 401, "Unauthorized.");
    }

    if (!color_type_name || color_type_name.trim() === "") {
      return errorResponse(res, 400, "Color type name is required.");
    }

    await client.query("BEGIN");

    const duplicateCheck = await client.query(
      `
      SELECT 1
      FROM color_type
      WHERE (company_id = $1 OR builder_id = $2)
        AND color_type_name = $3
      `,
      [companyId, builderId, color_type_name.trim()],
    );

    if (duplicateCheck.rowCount > 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 409, "Color type name already exists.");
    }

    // Create new color type
    const insertQuery = `
      INSERT INTO color_type (
        company_id, builder_id, color_type_name, created_by, updated_by
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;

    const result = await client.query(insertQuery, [
      companyId,
      builderId,
      color_type_name.trim(),
      userId,
      userId,
    ]);

    await client.query("COMMIT");

    const transformedData = keysToCamelCase(result.rows[0]);

    return successResponse(
      res,
      transformedData,
      "Color type created successfully.",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Create Color Type Error:", error);
    if (error.code === "23505") {
      return errorResponse(res, 409, "Color type name already exists.");
    }
    return errorResponse(res, 500, "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.getAllColorTypes = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId || !companyId) {
      return errorResponse(res, 401, "Unauthorized.");
    }

    const query = `
      SELECT 
        ct.color_type_id,
        ct.company_id,
        ct.builder_id,
        ct.color_type_name,
        ct.created_at,
        ct.updated_at,
        ct.created_by,
        ct.updated_by
      FROM color_type ct
      WHERE ct.company_id = $1 OR ct.builder_id = $2
      ORDER BY ct.created_at DESC;
    `;

    const result = await client.query(query, [companyId, builderId]);

    const transformedData = result.rows.map((row) => {
      const transformed = keysToCamelCase(row);
      return {
        colorTypeId: transformed.colorTypeId,
        companyId: transformed.companyId,
        builderId: transformed.builderId,
        colorTypeName: transformed.colorTypeName,
        createdAt: transformed.createdAt,
        updatedAt: transformed.updatedAt,
        createdBy: transformed.createdBy,
        updatedBy: transformed.updatedBy,
      };
    });

    return successResponse(
      res,
      transformedData,
      "Color types retrieved successfully.",
    );
  } catch (error) {
    console.error("Get All Color Types Error:", error);
    return errorResponse(res, 500, "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.getColorTypeById = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user.builder_id;
    const companyId = req.user.company_id;
    const { id } = req.params;

    if (!builderId || !companyId) {
      return errorResponse(res, 401, "Unauthorized.");
    }

    if (!id) {
      return errorResponse(res, 400, "Color type ID is required.");
    }

    const query = `
      SELECT 
        ct.color_type_id,
        ct.company_id,
        ct.builder_id,
        ct.color_type_name,
        ct.created_at,
        ct.updated_at,
        ct.created_by,
        ct.updated_by,
        u1.first_name || ' ' || u1.last_name as created_by_name,
        u2.first_name || ' ' || u2.last_name as updated_by_name
      FROM color_type ct
      LEFT JOIN users u1 ON ct.created_by = u1.users_id
      LEFT JOIN users u2 ON ct.updated_by = u2.users_id
      WHERE ct.color_type_id = $1
        AND (ct.company_id = $2 OR ct.builder_id = $3)
    `;

    const result = await client.query(query, [id, companyId, builderId]);

    if (result.rowCount === 0) {
      return errorResponse(res, 404, "Color type not found.");
    }

    const transformed = keysToCamelCase(result.rows[0]);
    const finalResponse = {
      colorTypeId: transformed.colorTypeId,
      companyId: transformed.companyId,
      builderId: transformed.builderId,
      colorTypeName: transformed.colorTypeName,
      createdAt: transformed.createdAt,
      updatedAt: transformed.updatedAt,
      createdBy: transformed.createdBy,
      updatedBy: transformed.updatedBy,
      createdByName: transformed.createdByName,
      updatedByName: transformed.updatedByName,
    };

    return successResponse(
      res,
      finalResponse,
      "Color type retrieved successfully.",
    );
  } catch (error) {
    console.error("Get Color Type By ID Error:", error);
    return errorResponse(res, 500, "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.updateColorType = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.users_id;
    const { id } = req.params;
    const { color_type_name } = req.body;

    if (!builderId || !companyId) {
      return errorResponse(res, 401, "Unauthorized.");
    }

    if (!id) {
      return errorResponse(res, 400, "Color type ID is required.");
    }

    await client.query("BEGIN");

    const existingCheck = await client.query(
      `
      SELECT color_type_id, color_type_name
      FROM color_type
      WHERE color_type_id = $1
        AND (company_id = $2 OR builder_id = $3)
      `,
      [id, companyId, builderId],
    );

    if (existingCheck.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Color type not found.");
    }

    if (
      color_type_name &&
      color_type_name.trim() !== existingCheck.rows[0].color_type_name
    ) {
      const duplicateCheck = await client.query(
        `
        SELECT 1
        FROM color_type
        WHERE (company_id = $1 OR builder_id = $2)
          AND color_type_name = $3
          AND color_type_id != $4
        `,
        [companyId, builderId, color_type_name.trim(), id],
      );

      if (duplicateCheck.rowCount > 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 409, "Color type name already exists.");
      }
    }

    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;

    if (color_type_name !== undefined) {
      updateFields.push(`color_type_name = $${paramIndex++}`);
      updateValues.push(color_type_name.trim());
    }

    if (updateFields.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "At least one field is required to update.",
      );
    }

    updateFields.push(`updated_by = $${paramIndex++}`);
    updateFields.push(`updated_at = NOW()`);
    updateValues.push(userId);

    updateValues.push(id, companyId, builderId);

    const updateQuery = `
      UPDATE color_type
      SET ${updateFields.join(", ")}
      WHERE color_type_id = $${paramIndex++}
        AND (company_id = $${paramIndex++} OR builder_id = $${paramIndex++})
      RETURNING *;
    `;

    const result = await client.query(updateQuery, updateValues);

    await client.query("COMMIT");

    const transformedData = keysToCamelCase(result.rows[0]);

    return successResponse(
      res,
      transformedData,
      "Color type updated successfully.",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Update Color Type Error:", error);
    if (error.code === "23505") {
      return errorResponse(res, 409, "Color type name already exists.");
    }
    return errorResponse(res, 500, "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.deleteColorType = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const { id } = req.params;

    if (!builderId || !companyId) {
      return errorResponse(res, 401, "Unauthorized.");
    }

    if (!id) {
      return errorResponse(res, 400, "Color type ID is required.");
    }

    await client.query("BEGIN");

    const existingCheck = await client.query(
      `
      SELECT color_type_id
      FROM color_type
      WHERE color_type_id = $1
        AND (company_id = $2 OR builder_id = $3)
      `,
      [id, companyId, builderId],
    );

    if (existingCheck.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Color type not found.");
    }

    // Delete color type
    const deleteQuery = `
      DELETE FROM color_type
      WHERE color_type_id = $1
        AND (company_id = $2 OR builder_id = $3)
      RETURNING color_type_id;
    `;

    const result = await client.query(deleteQuery, [id, companyId, builderId]);

    await client.query("COMMIT");

    return successResponse(
      res,

      "Color type deleted successfully.",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Delete Color Type Error:", error);
    return errorResponse(res, 500, "Internal Server Error");
  } finally {
    client.release();
  }
};
