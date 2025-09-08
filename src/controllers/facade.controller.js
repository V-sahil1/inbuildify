const getPool = require("../config/database");
const { errorResponse, successResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");
const { deleteFromS3 } = require("../utils/s3Upload");

exports.createFacade = async (req, res) => {
  const {
    name,
    dwelling_type,
    standard,
    upgrade,
    cost
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
      WHERE LOWER(name) = $1 AND builder_id = $2 AND is_deleted = $3;
    `;
    const existingFacadeResult = await client.query(existingFacadeQuery, [
      name.toLowerCase(),
      builderId,
      false
    ]);

    if (existingFacadeResult.rows.length > 0) {
      return errorResponse(res, 409, "Facade with this name already exists for this builder.");
    }

    const dwellingTypeQuery = `SELECT dwelling_type_id FROM dwelling_type WHERE name = $1 AND is_deleted = $2;`;
    const dwellingTypeResult = await client.query(dwellingTypeQuery, [dwelling_type, false]);

    if (dwellingTypeResult.rows.length === 0) {
      return errorResponse(res, 404, "Invalid dwelling type.");
    }
    
    const facadeQuery = `
      INSERT INTO facade (
        builder_id, name, image, dwelling_type_id, standard, upgrade, cost
      ) VALUES ($1, $2, $3, $4, $5, $6, $7) 
      RETURNING *;
    `;
    
    const facadeResult = await client.query(facadeQuery, [
      builderId,
      name,
      imageUrl || null,
      dwellingTypeResult.rows[0].dwelling_type_id,
      standard || false,
      upgrade || false,
      cost || 0
    ]);
    
    const createdFacade = {...facadeResult.rows[0], dwelling_type_name: dwelling_type};
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
        'SELECT dwelling_type_id FROM dwelling_type WHERE name = $1 AND is_deleted = $2',
        [dwelling_type, false]
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
      WHERE f.builder_id = $1 AND f.is_deleted = false
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
      WHERE f.builder_id = $1 AND f.is_deleted = $2
    `;
    const countParams = [builderId, false];
    let countParamIndex = 3;

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
      WHERE facade_id = $1 AND builder_id = $2 AND is_deleted = false;
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
  const { facade_id } = req.params;
  const builderId = req.user.builder_id;
  const updates = req.body;
  const imageUrl = req.file?.location;

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const checkFacadeQuery = `
      SELECT * FROM facade f
      LEFT JOIN dwelling_type dt ON f.dwelling_type_id = dt.dwelling_type_id
      WHERE f.facade_id = $1 AND f.builder_id = $2 AND f.is_deleted = $3;
    `;
    const checkFacadeResult = await client.query(checkFacadeQuery, [facade_id, builderId, false]);

    if (checkFacadeResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Facade not found.");
    }

    if (updates.name) {
      const existingNameQuery = `
        SELECT facade_id FROM facade 
        WHERE LOWER(name) = $1 AND builder_id = $2 AND facade_id != $3 AND is_deleted = $4;
      `;
      const existingNameResult = await client.query(existingNameQuery, [
        updates.name.toLowerCase(),
        builderId,
        facade_id,
        false
      ]);

      if (existingNameResult.rows.length > 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 409, "Facade with this name already exists for this builder.");
      }
    }

    const setClauses = [];
    const values = [];
    let idx = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (["image", "dwelling_type"].includes(key)) {
        continue;
      }
      setClauses.push(`${key} = $${idx}`);
      values.push(value);
      idx++;
    }

    values.push(facade_id, builderId);

    if (updates.dwelling_type) {
      const dwellingTypeQuery = `SELECT dwelling_type_id FROM dwelling_type WHERE name = $1 AND is_deleted = $2;`;
      const dwellingTypeResult = await client.query(dwellingTypeQuery, [updates.dwelling_type, false]);

      if (dwellingTypeResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 404, "Invalid dwelling type.");
      }

      setClauses.push(`dwelling_type_id = $${idx}`);
      values.push(dwellingTypeResult.rows[0].dwelling_type_id);
      idx++;
    }

    const updateQuery = `
      UPDATE facade 
      SET ${setClauses.join(", ")}, updated_at = NOW()
      WHERE facade_id = $${idx} AND builder_id = $${idx + 1}
      RETURNING *;
    `;

    const updateResult = await client.query(updateQuery, values);

    if (updateResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Facade not found.");
    }

    let updatedImage;
    if (imageUrl !== undefined) {
      await deleteFromS3(checkFacadeResult.rows[0].image);

      const updateImageQuery = `
        UPDATE facade 
        SET image = $1, updated_at = NOW()
        WHERE facade_id = $2 AND builder_id = $3 AND is_deleted = $4;
      `;
      await client.query(updateImageQuery, [imageUrl, facade_id, builderId, false]);
      updatedImage = imageUrl;
    } else {
      const oldImges = await client.query(`SELECT image FROM facade WHERE facade_id = $1 AND builder_id = $2 AND is_deleted = $3`, [facade_id, builderId, false]);
      updatedImage = oldImges.rows[0].image;
    }

    await client.query("COMMIT");

    const finalUpdatedData = {
      ...updateResult.rows[0],
      image: updatedImage
    };

    return successResponse(
      res,
      keysToCamelCase(finalUpdatedData),
      "Facade updated successfully."
    );

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error updating facade:", error);

    if (error.code === "23505") {
      return errorResponse(res, 409, "Facade with this name already exists.");
    }

    return errorResponse(res, 500, "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.deleteFacade = async (req, res) => {
  const { facade_id } = req.params;
  const builderId = req.user.builder_id;

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const checkFacadeQuery = `
      SELECT * FROM facade WHERE facade_id = $1 AND builder_id = $2 AND is_deleted = false;
    `;
    const checkFacadeResult = await client.query(checkFacadeQuery, [facade_id, builderId]);

    if (checkFacadeResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Facade not found.");
    }

    const deleteQuery = `
      UPDATE facade 
      SET is_deleted = true, updated_at = NOW()
      WHERE facade_id = $1 AND builder_id = $2;
    `;
    const deleteResult = await client.query(deleteQuery, [facade_id, builderId]);

    if (deleteResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Facade not found.");
    }

    await client.query("COMMIT");

    return successResponse(res, {}, "Facade deleted successfully.");
  } catch (error) {
    await client.query("ROLLBACK");
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
      WHERE f.builder_id = $1 AND dt.name IS NOT NULL AND f.is_deleted = false
      ORDER BY dt.name;
    `;

    const standardQuery = `
      SELECT DISTINCT standard 
      FROM facade 
      WHERE builder_id = $1 AND is_deleted = false
      ORDER BY standard;
    `;

    const upgradeQuery = `
      SELECT DISTINCT upgrade 
      FROM facade 
      WHERE builder_id = $1 AND is_deleted = false
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