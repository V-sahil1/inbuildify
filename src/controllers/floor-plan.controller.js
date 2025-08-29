const getPool = require("../config/database");
const { errorResponse, successResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.createFloorPlan = async (req, res) => {
  const {
    name,
    range,
    dwelling_type,
    beds,
    bath,
    car_park,
    width_meter,
    depth_meter,
    dwelling,
    garage,
    porch,
    alfresco,
    total_sqft
  } = req.body || {};
  const image = req.file?.location || req.body.image || null;
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

    // Check if floor plan with same name already exists for this builder
    const existingFloorPlanQuery = `
      SELECT floor_plan_id, name FROM floor_plan 
      WHERE LOWER(name) = $1 AND builder_id = $2;
    `;
    const existingFloorPlanResult = await client.query(existingFloorPlanQuery, [
      name.toLowerCase(),
      builderId
    ]);

    if (existingFloorPlanResult.rows.length > 0) {
      return errorResponse(res, 409, "Floor plan with this name already exists for this builder.");
    }

    const rangeQuery = `
      SELECT range_id, name FROM range 
      WHERE name = $1;
    `;
    const rangeResult = await client.query(rangeQuery, [range]);

    if (rangeResult.rows.length === 0) {
      return errorResponse(res, 404, "Invalid range.");
    }
    
    const dwellingTypeQuery = `
      SELECT dwelling_type_id, name FROM dwelling_type 
      WHERE name = $1;
    `;
    const dwellingTypeResult = await client.query(dwellingTypeQuery, [dwelling_type]);

    if (dwellingTypeResult.rows.length === 0) {
      return errorResponse(res, 404, "Invalid dwelling type.");
    }

    const floorPlanQuery = `
      INSERT INTO floor_plan (
        builder_id, name, image, range_id, dwelling_type_id, beds, bath, car_park,
        width_meter, depth_meter, dwelling, garage, porch, alfresco, total_sqft
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) 
      RETURNING *;
    `;
    
    const floorPlanResult = await client.query(floorPlanQuery, [
      builderId,
      name,
      image || null,
      rangeResult.rows[0].range_id,
      dwellingTypeResult.rows[0].dwelling_type_id,
      beds || 0,
      bath || 0,
      car_park || 0,
      width_meter || 0,
      depth_meter || 0,
      dwelling || 0,
      garage || 0,
      porch || 0,
      alfresco || 0,
      total_sqft || 0
    ]);
    
    const createdFloorPlan = {...floorPlanResult.rows[0], range_name: rangeResult.rows[0].name, dwelling_type_name: dwellingTypeResult.rows[0].name};
    return successResponse(
      res,
      keysToCamelCase(createdFloorPlan),
      "Floor plan created successfully."
    );
  } catch (error) {
    console.error('Create floor plan error:', error);
    return errorResponse(res, 500, "Failed to create floor plan.");
  } finally {
    client.release();
  }
};

exports.getFloorPlans = async (req, res) => {
  const builderId = req.user.builder_id;
  const { range, dwelling_type, page = 1, limit = 25 } = req.query;

  const pool = getPool();
  const client = await pool.connect();

  try {
    let rangeId = null;
    let dwellingTypeId = null;

    if (range && range !== 'all') {
      const rangeResult = await client.query(
        'SELECT range_id, name FROM range WHERE name = $1',
        [range]
      );
      if (rangeResult.rows.length === 0) {
        return errorResponse(res, 400, 'Invalid range value');
      }
      rangeId = rangeResult.rows[0].range_id;
    }

    if (dwelling_type && dwelling_type !== 'all') {
      const dwellingTypeResult = await client.query(
        'SELECT dwelling_type_id, name FROM dwelling_type WHERE name = $1',
        [dwelling_type]
      );
      if (dwellingTypeResult.rows.length === 0) {
        return errorResponse(res, 400, 'Invalid dwelling type value');
      }
      dwellingTypeId = dwellingTypeResult.rows[0].dwelling_type_id;
    }

    let baseQuery = `
      SELECT 
        fp.*, 
        r.name AS range_name, 
        dt.name AS dwelling_type_name
      FROM floor_plan fp
      JOIN range r ON fp.range_id = r.range_id
      JOIN dwelling_type dt ON fp.dwelling_type_id = dt.dwelling_type_id
      WHERE fp.builder_id = $1
    `;

    const queryParams = [builderId];
    let paramIndex = 2;

    if (rangeId) {
      baseQuery += ` AND fp.range_id = $${paramIndex}`;
      queryParams.push(rangeId);
      paramIndex++;
    }

    if (dwellingTypeId) {
      baseQuery += ` AND fp.dwelling_type_id = $${paramIndex}`;
      queryParams.push(dwellingTypeId);
      paramIndex++;
    }

    const offset = (page - 1) * limit;
    baseQuery += ` ORDER BY fp.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    queryParams.push(limit, offset);

    const result = await client.query(baseQuery, queryParams);

    let countQuery = `
      SELECT COUNT(*) as total
      FROM floor_plan fp
      WHERE fp.builder_id = $1
    `;
    const countParams = [builderId];
    let countParamIndex = 2;

    if (rangeId) {
      countQuery += ` AND fp.range_id = $${countParamIndex}`;
      countParams.push(rangeId);
      countParamIndex++;
    }

    if (dwellingTypeId) {
      countQuery += ` AND fp.dwelling_type_id = $${countParamIndex}`;
      countParams.push(dwellingTypeId);
    }

    const countResult = await client.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].total);

    return successResponse(
      res,
      {
        floorPlans: keysToCamelCase(result.rows),
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalRecords: total,
          limit: parseInt(limit),
        },
      },
      'Floor plans fetched successfully.'
    );
  } catch (error) {
    console.error('Get floor plans error:', error);
    return errorResponse(res, 500, 'Internal Server Error');
  } finally {
    client.release();
  }
};

exports.getFloorPlanById = async (req, res) => {
  const { id } = req.params;
  const builderId = req.user.builder_id;

  const pool = getPool();
  const client = await pool.connect();

  try {
    const query = `
      SELECT * FROM floor_plan 
      WHERE id = $1 AND builder_id = $2;
    `;
    const result = await client.query(query, [id, builderId]);

    if (result.rowCount === 0) {
      return errorResponse(res, 404, "Floor plan not found.");
    }

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Floor plan fetched successfully."
    );
  } catch (error) {
    console.error("Get floor plan by ID error:", error);
    return errorResponse(res, 500, "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.updateFloorPlan = async (req, res) => {
  const { id } = req.params;
  const builderId = req.user.builder_id;
  const updates = req.body;

  const pool = getPool();
  const client = await pool.connect();

  try {
    // Check if floor plan exists and belongs to the builder
    const checkFloorPlanQuery = `
      SELECT * FROM floor_plan 
      WHERE id = $1 AND builder_id = $2;
    `;
    const checkFloorPlanResult = await client.query(checkFloorPlanQuery, [id, builderId]);
    
    if (checkFloorPlanResult.rowCount === 0) {
      return errorResponse(res, 404, "Floor plan not found.");
    }

    // If updating name, check for duplicates
    if (updates.name) {
      const existingNameQuery = `
        SELECT id FROM floor_plan 
        WHERE LOWER(name) = $1 AND builder_id = $2 AND id != $3;
      `;
      const existingNameResult = await client.query(existingNameQuery, [
        updates.name.toLowerCase(),
        builderId,
        id
      ]);

      if (existingNameResult.rows.length > 0) {
        return errorResponse(res, 409, "Floor plan with this name already exists for this builder.");
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
      UPDATE floor_plan 
      SET ${setClauses.join(", ")}, updated_at = NOW()
      WHERE id = $${idx} AND builder_id = $${idx + 1}
      RETURNING *;
    `;

    const updateResult = await client.query(updateQuery, values);

    if (updateResult.rowCount === 0) {
      return errorResponse(res, 404, "Floor plan not found.");
    }

    return successResponse(
      res,
      keysToCamelCase(updateResult.rows[0]),
      "Floor plan updated successfully."
    );

  } catch (error) {
    console.error("Error updating floor plan:", error);
    
    if (error.code === '23505') { // Unique constraint violation
      return errorResponse(res, 409, "Floor plan with this name already exists.");
    }
    
    return errorResponse(res, 500, "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.deleteFloorPlan = async (req, res) => {
  const { id } = req.params;
  const builderId = req.user.builder_id;

  const pool = getPool();
  const client = await pool.connect();

  try {
    // Check if floor plan exists and belongs to the builder
    const checkFloorPlanQuery = `
      SELECT * FROM floor_plan 
      WHERE id = $1 AND builder_id = $2;
    `;
    const checkFloorPlanResult = await client.query(checkFloorPlanQuery, [id, builderId]);
    
    if (checkFloorPlanResult.rowCount === 0) {
      return errorResponse(res, 404, "Floor plan not found.");
    }

    const deleteQuery = `DELETE FROM floor_plan WHERE id = $1 AND builder_id = $2;`;
    const deleteResult = await client.query(deleteQuery, [id, builderId]);

    if (deleteResult.rowCount === 0) {
      return errorResponse(res, 404, "Floor plan not found.");
    }

    return successResponse(res, {}, "Floor plan deleted successfully.");
  } catch (error) {
    console.error("Error deleting floor plan:", error);
    return errorResponse(res, 500, "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.getFloorPlanFilters = async (req, res) => {
  const builderId = req.user.builder_id;

  const pool = getPool();
  const client = await pool.connect();

  try {
    const rangeQuery = `
      SELECT DISTINCT r.name
      FROM floor_plan fp
      JOIN range r ON fp.range_id = r.range_id
      WHERE fp.builder_id = $1 AND r.name IS NOT NULL
      ORDER BY r.name;
    `;

    const dwellingTypeQuery = `
      SELECT DISTINCT dt.name
      FROM floor_plan fp
      JOIN dwelling_type dt ON fp.dwelling_type_id = dt.dwelling_type_id
      WHERE fp.builder_id = $1 AND dt.name IS NOT NULL
      ORDER BY dt.name;
    `;

    const [rangeResult, dwellingTypeResult] = await Promise.all([
      client.query(rangeQuery, [builderId]),
      client.query(dwellingTypeQuery, [builderId])
    ]);

    const filters = {
      ranges: rangeResult.rows.map(row => row.name),
      dwellingTypes: dwellingTypeResult.rows.map(row => row.name)
    };

    return successResponse(
      res,
      filters,
      "Floor plan filters fetched successfully."
    );
  } catch (error) {
    console.error("Get floor plan filters error:", error);
    return errorResponse(res, 500, "Internal Server Error");
  } finally {
    client.release();
  }
};
