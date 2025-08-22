const getPool = require("../config/database");
const { errorResponse, successResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.createFloorPlan = async (req, res) => {
  const {
    name,
    image,
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
      SELECT id, name FROM floor_plan 
      WHERE LOWER(name) = $1 AND builder_id = $2;
    `;
    const existingFloorPlanResult = await client.query(existingFloorPlanQuery, [
      name.toLowerCase(),
      builderId
    ]);

    if (existingFloorPlanResult.rows.length > 0) {
      return errorResponse(res, 409, "Floor plan with this name already exists for this builder.");
    }

    const floorPlanQuery = `
      INSERT INTO floor_plan (
        builder_id, name, image, range, dwelling_type, beds, bath, car_park,
        width_meter, depth_meter, dwelling, garage, porch, alfresco, total_sqft
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) 
      RETURNING *;
    `;
    
    const floorPlanResult = await client.query(floorPlanQuery, [
      builderId,
      name,
      image || null,
      range || 'none',
      dwelling_type || 'single_storey',
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
    
    const createdFloorPlan = floorPlanResult.rows[0];
    return successResponse(
      res,
      keysToCamelCase(createdFloorPlan),
      "Floor plan created successfully."
    );

  } catch (error) {
    console.error('Create floor plan error:', error);

    // Handle specific database errors
    if (error.code === '23505') { // Unique constraint violation
      return errorResponse(res, 409, "Floor plan with this name already exists.");
    }
    
    return errorResponse(res, 500, "Failed to create floor plan.");
  } finally {
    client.release();
  }
};

exports.getFloorPlans = async (req, res) => {
  const builderId = req.user.builder_id;
  const { range, dwelling_type, page = 1, limit = 10 } = req.query;

  const pool = getPool();
  const client = await pool.connect();

  try {
    let baseQuery = `
      SELECT * FROM floor_plan 
      WHERE builder_id = $1
    `;
    
    const queryParams = [builderId];
    let paramIndex = 2;

    // Add filters
    if (range && range !== 'all') {
      baseQuery += ` AND range = $${paramIndex}`;
      queryParams.push(range);
      paramIndex++;
    }

    if (dwelling_type && dwelling_type !== 'all') {
      baseQuery += ` AND dwelling_type = $${paramIndex}`;
      queryParams.push(dwelling_type);
      paramIndex++;
    }

    // Add pagination
    const offset = (page - 1) * limit;
    baseQuery += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    queryParams.push(limit, offset);

    const result = await client.query(baseQuery, queryParams);

    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(*) as total FROM floor_plan 
      WHERE builder_id = $1
    `;
    const countParams = [builderId];
    let countParamIndex = 2;

    if (range && range !== 'all') {
      countQuery += ` AND range = $${countParamIndex}`;
      countParams.push(range);
      countParamIndex++;
    }

    if (dwelling_type && dwelling_type !== 'all') {
      countQuery += ` AND dwelling_type = $${countParamIndex}`;
      countParams.push(dwelling_type);
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
          limit: parseInt(limit)
        }
      },
      "Floor plans fetched successfully."
    );
  } catch (error) {
    console.error("Get floor plans error:", error);
    return errorResponse(res, 500, "Internal Server Error");
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
      SELECT DISTINCT range FROM floor_plan 
      WHERE builder_id = $1 AND range IS NOT NULL 
      ORDER BY range;
    `;
    
    const dwellingTypeQuery = `
      SELECT DISTINCT dwelling_type FROM floor_plan 
      WHERE builder_id = $1 AND dwelling_type IS NOT NULL 
      ORDER BY dwelling_type;
    `;

    const [rangeResult, dwellingTypeResult] = await Promise.all([
      client.query(rangeQuery, [builderId]),
      client.query(dwellingTypeQuery, [builderId])
    ]);

    const filters = {
      ranges: rangeResult.rows.map(row => row.range),
      dwellingTypes: dwellingTypeResult.rows.map(row => row.dwelling_type)
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
