const getPool = require("../config/database");
const { errorResponse, successResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.createFacade = async (req, res) => {
  const {
    name,
    dwelling_type,
    standard,
    upgrade
  } = req.body || {};
  const imageUrl = req.file?.location; // S3 URL from multer-s3
  const builderId = req.user.builder_id;

  const pool = getPool();
  const client = await pool.connect();

  try {
    // Check if builder exists
    const builderQuery = `SELECT * FROM builder WHERE builder_id = $1;`;
    const builderResult = await client.query(builderQuery, [builderId]);

    if (builderResult.rows.length === 0) {
      return errorResponse(res, 404, "Builder not found with the provided ID.");
    }

    // Check if facade with same name already exists for this builder
    const existingFacadeQuery = `
      SELECT facade_id, name FROM facade 
      WHERE LOWER(name) = $1 AND builder_id = $2;
    `;
    const existingFacadeResult = await client.query(existingFacadeQuery, [
      name.toLowerCase(),
      builderId
    ]);

    if (existingFacadeResult.rows.length > 0) {
      return errorResponse(res, 409, "Facade with this name already exists for this builder.");
    }

    const dwellingTypeQuery = `
      SELECT dwelling_type_id FROM dwelling_type 
      WHERE name = $1;
    `;
    const dwellingTypeResult = await client.query(dwellingTypeQuery, [dwelling_type]);

    if (dwellingTypeResult.rows.length === 0) {
      return errorResponse(res, 404, "Invalid dwelling type.");
    }
    
    const facadeQuery = `
      INSERT INTO facade (
        builder_id, name, image, dwelling_type_id, standard, upgrade
      ) VALUES ($1, $2, $3, $4, $5, $6) 
      RETURNING *;
    `;
    
    const facadeResult = await client.query(facadeQuery, [
      builderId,
      name,
      imageUrl || null,
      dwellingTypeResult.rows[0].dwelling_type_id,
      standard || false,
      upgrade || false
    ]);
    
    const createdFacade = facadeResult.rows[0];
    return successResponse(
      res,
      keysToCamelCase(createdFacade),
      "Facade created successfully."
    );

  } catch (error) {
    console.error('Create facade error:', error);

    // Handle specific database errors
    if (error.code === '23505') { // Unique constraint violation
      return errorResponse(res, 409, "Facade with this name already exists.");
    }
    
    return errorResponse(res, 500, error.message || "Failed to create facade.");
  } finally {
    client.release();
  }
};

exports.getFacades = async (req, res) => {
  const builderId = req.user.builder_id;
  const { dwelling_type, standard, upgrade, page = 1, limit = 25 } = req.query;

  const pool = getPool();
  const client = await pool.connect();

  try {
    let dwellingTypeId = null;

    if (dwelling_type && dwelling_type !== 'all') {
      const dtResult = await client.query(
        'SELECT dwelling_type_id FROM dwelling_type WHERE name = $1',
        [dwelling_type]
      );
      if (dtResult.rows.length === 0) {
        return errorResponse(res, 400, 'Invalid dwelling type');
      }
      dwellingTypeId = dtResult.rows[0].dwelling_type_id;
    }

    let baseQuery = `
      SELECT 
        f.*, 
        dt.name AS dwelling_type_name
      FROM facade f
      JOIN dwelling_type dt ON f.dwelling_type_id = dt.dwelling_type_id
      WHERE f.builder_id = $1
    `;
    
    const queryParams = [builderId];
    let paramIndex = 2;

    if (dwellingTypeId) {
      baseQuery += ` AND f.dwelling_type_id = $${paramIndex}`;
      queryParams.push(dwellingTypeId);
      paramIndex++;
    }

    if (standard && standard !== 'all') {
      baseQuery += ` AND f.standard = $${paramIndex}`;
      queryParams.push(standard === 'true');
      paramIndex++;
    }

    if (upgrade && upgrade !== 'all') {
      baseQuery += ` AND f.upgrade = $${paramIndex}`;
      queryParams.push(upgrade === 'true');
      paramIndex++;
    }

    const offset = (page - 1) * limit;
    baseQuery += ` ORDER BY f.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    queryParams.push(limit, offset);

    const result = await client.query(baseQuery, queryParams);

    let countQuery = `
      SELECT COUNT(*) as total
      FROM facade f
      WHERE f.builder_id = $1
    `;
    const countParams = [builderId];
    let countParamIndex = 2;

    if (dwellingTypeId) {
      countQuery += ` AND f.dwelling_type_id = $${countParamIndex}`;
      countParams.push(dwellingTypeId);
      countParamIndex++;
    }

    if (standard && standard !== 'all') {
      countQuery += ` AND f.standard = $${countParamIndex}`;
      countParams.push(standard === 'true');
      countParamIndex++;
    }

    if (upgrade && upgrade !== 'all') {
      countQuery += ` AND f.upgrade = $${countParamIndex}`;
      countParams.push(upgrade === 'true');
    }

    const countResult = await client.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].total);

    return successResponse(
      res,
      {
        facades: keysToCamelCase(result.rows),
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalRecords: total,
          limit: parseInt(limit)
        }
      },
      "Facades fetched successfully."
    );
  } catch (error) {
    console.error("Get facades error:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.getFacadeById = async (req, res) => {
  const { id } = req.params;
  const builderId = req.user.builder_id;

  const pool = getPool();
  const client = await pool.connect();

  try {
    const query = `
      SELECT * FROM facade 
      WHERE id = $1 AND builder_id = $2;
    `;
    const result = await client.query(query, [id, builderId]);

    if (result.rowCount === 0) {
      return errorResponse(res, 404, "Facade not found.");
    }

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Facade fetched successfully."
    );
  } catch (error) {
    console.error("Get facade by ID error:", error);
    return errorResponse(res, 500, "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.updateFacade = async (req, res) => {
  const { id } = req.params;
  const builderId = req.user.builder_id;
  const updates = req.body;

  const pool = getPool();
  const client = await pool.connect();

  try {
    // Check if facade exists and belongs to the builder
    const checkFacadeQuery = `
      SELECT * FROM facade 
      WHERE id = $1 AND builder_id = $2;
    `;
    const checkFacadeResult = await client.query(checkFacadeQuery, [id, builderId]);
    
    if (checkFacadeResult.rowCount === 0) {
      return errorResponse(res, 404, "Facade not found.");
    }

    // If updating name, check for duplicates
    if (updates.name) {
      const existingNameQuery = `
        SELECT id FROM facade 
        WHERE LOWER(name) = $1 AND builder_id = $2 AND id != $3;
      `;
      const existingNameResult = await client.query(existingNameQuery, [
        updates.name.toLowerCase(),
        builderId,
        id
      ]);

      if (existingNameResult.rows.length > 0) {
        return errorResponse(res, 409, "Facade with this name already exists for this builder.");
      }
    }

    const setClauses = [];
    const values = [];
    let idx = 1;

    for (const [key, value] of Object.entries(updates)) {
      setClauses.push(`${key} = $${idx}`);
      values.push(value);
      idx++;
    }

    values.push(id, builderId);

    const updateQuery = `
      UPDATE facade 
      SET ${setClauses.join(", ")}, updated_at = NOW()
      WHERE id = $${idx} AND builder_id = $${idx + 1}
      RETURNING *;
    `;

    const updateResult = await client.query(updateQuery, values);

    if (updateResult.rowCount === 0) {
      return errorResponse(res, 404, "Facade not found.");
    }

    return successResponse(
      res,
      keysToCamelCase(updateResult.rows[0]),
      "Facade updated successfully."
    );

  } catch (error) {
    console.error("Error updating facade:", error);
    
    if (error.code === '23505') { // Unique constraint violation
      return errorResponse(res, 409, "Facade with this name already exists.");
    }
    
    return errorResponse(res, 500, "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.deleteFacade = async (req, res) => {
  const { id } = req.params;
  const builderId = req.user.builder_id;

  const pool = getPool();
  const client = await pool.connect();

  try {
    // Check if facade exists and belongs to the builder
    const checkFacadeQuery = `
      SELECT * FROM facade 
      WHERE id = $1 AND builder_id = $2;
    `;
    const checkFacadeResult = await client.query(checkFacadeQuery, [id, builderId]);
    
    if (checkFacadeResult.rowCount === 0) {
      return errorResponse(res, 404, "Facade not found.");
    }

    const deleteQuery = `DELETE FROM facade WHERE id = $1 AND builder_id = $2;`;
    const deleteResult = await client.query(deleteQuery, [id, builderId]);

    if (deleteResult.rowCount === 0) {
      return errorResponse(res, 404, "Facade not found.");
    }

    return successResponse(res, {}, "Facade deleted successfully.");
  } catch (error) {
    console.error("Error deleting facade:", error);
    return errorResponse(res, 500, "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.getFacadeFilters = async (req, res) => {
  const builderId = req.user.builder_id;

  const pool = getPool();
  const client = await pool.connect();

  try {
    const dwellingTypeQuery = `
      SELECT DISTINCT dt.name AS dwelling_type
      FROM facade f
      JOIN dwelling_type dt ON f.dwelling_type_id = dt.dwelling_type_id
      WHERE f.builder_id = $1 AND dt.name IS NOT NULL
      ORDER BY dt.name;
    `;

    const standardQuery = `
      SELECT DISTINCT standard 
      FROM facade 
      WHERE builder_id = $1 
      ORDER BY standard;
    `;

    const upgradeQuery = `
      SELECT DISTINCT upgrade 
      FROM facade 
      WHERE builder_id = $1 
      ORDER BY upgrade;
    `;

    const [dwellingTypeResult, standardResult, upgradeResult] = await Promise.all([
      client.query(dwellingTypeQuery, [builderId]),
      client.query(standardQuery, [builderId]),
      client.query(upgradeQuery, [builderId])
    ]);

    const filters = {
      dwellingTypes: dwellingTypeResult.rows.map(row => row.dwelling_type),
      standardOptions: standardResult.rows.map(row => row.standard),
      upgradeOptions: upgradeResult.rows.map(row => row.upgrade)
    };

    return successResponse(
      res,
      filters,
      "Facade filters fetched successfully."
    );
  } catch (error) {
    console.error("Get facade filters error:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
};