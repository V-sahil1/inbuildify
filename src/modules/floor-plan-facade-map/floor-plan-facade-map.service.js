const getPool = require("../../config/database");
const { keysToCamelCase } = require("../../utils/common");

/**
 * CREATE FLOOR PLAN FACADE MAP
 */
async function createFloorPlanFacadeMap(currentUser, payload) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { floor_plan_id, facade_id } = payload;
    const builderId = currentUser.builder_id;
    const companyId = currentUser.company_id;

    // Validate floor plan exists and belongs to user's organization
    const floorPlanCheck = await client.query(
      `
      SELECT floor_plan_id, name 
      FROM floor_plan
      WHERE floor_plan_id = $1
        AND (company_id = $2 OR builder_id = $3)
      `,
      [floor_plan_id, companyId, builderId],
    );

    if (floorPlanCheck.rows.length === 0) {
      throw {
        status: 404,
        message: "Floor plan not found or does not belong to your organization",
      };
    }

    // Validate facade exists and belongs to user's organization
    const facadeCheck = await client.query(
      `
      SELECT facade_id, name 
      FROM facade
      WHERE facade_id = $1
        AND (company_id = $2 OR builder_id = $3)
      `,
      [facade_id, companyId, builderId],
    );

    if (facadeCheck.rows.length === 0) {
      throw {
        status: 404,
        message: "Facade not found or does not belong to your organization",
      };
    }

    // Check for duplicate mapping
    const duplicateCheck = await client.query(
      `
      SELECT id 
      FROM floor_plan_facade_map
      WHERE floor_plan_id = $1 AND facade_id = $2
      `,
      [floor_plan_id, facade_id],
    );

    if (duplicateCheck.rows.length > 0) {
      throw {
        status: 409,
        message: "This floor plan is already mapped to this facade",
      };
    }

    // Create the mapping
    const { rows } = await client.query(
      `
      INSERT INTO floor_plan_facade_map
      (floor_plan_id, facade_id)
      VALUES ($1, $2)
      RETURNING *
      `,
      [floor_plan_id, facade_id],
    );

    await client.query("COMMIT");

    // Transform the response to return just the mapping with IDs
    const newMapping = rows[0];
    return {
      id: newMapping.id,
      floorPlanId: newMapping.floor_plan_id,
      facadeId: newMapping.facade_id,
      createdAt: newMapping.created_at,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * GET ALL FLOOR PLAN FACADE MAPS
 */
async function getFloorPlanFacadeMaps(currentUser, filters = {}) {
  const pool = getPool();

  const builderId = currentUser.builder_id;
  const companyId = currentUser.company_id;
  const { floor_plan_id, facade_id, page = 1, limit = 25 } = filters;

  const offset = (page - 1) * limit;

  let whereClause = "WHERE (fp.company_id = $1 OR fp.builder_id = $2)";
  let values = [companyId, builderId];
  let paramIndex = 3;

  if (floor_plan_id) {
    whereClause += ` AND fpfm.floor_plan_id = $${paramIndex++}`;
    values.push(floor_plan_id);
  }

  if (facade_id) {
    whereClause += ` AND fpfm.facade_id = $${paramIndex++}`;
    values.push(facade_id);
  }

  const { rows } = await pool.query(
    `
    SELECT 
      fpfm.id,
      fpfm.floor_plan_id,
      fpfm.facade_id,
      fpfm.created_at,
      fpfm.updated_at
    FROM floor_plan_facade_map fpfm
    INNER JOIN floor_plan fp ON fp.floor_plan_id = fpfm.floor_plan_id
    INNER JOIN facade f ON f.facade_id = fpfm.facade_id
    ${whereClause}
    ORDER BY fpfm.created_at DESC
    LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `,
    [...values, limit, offset],
  );

  const countValues = [companyId, builderId];
  let countParamIndex = 3;
  let countWhereClause = "WHERE (fp.company_id = $1 OR fp.builder_id = $2)";

  if (floor_plan_id) {
    countWhereClause += ` AND fpfm.floor_plan_id = $${countParamIndex++}`;
    countValues.push(floor_plan_id);
  }

  if (facade_id) {
    countWhereClause += ` AND fpfm.facade_id = $${countParamIndex++}`;
    countValues.push(facade_id);
  }

  const countResult = await pool.query(
    `
    SELECT COUNT(*)::int
    FROM floor_plan_facade_map fpfm
    INNER JOIN floor_plan fp ON fp.floor_plan_id = fpfm.floor_plan_id
    INNER JOIN facade f ON f.facade_id = fpfm.facade_id
    ${countWhereClause}
    `,
    countValues,
  );

  const mappings = rows.map((row) => ({
    id: row.id,
    floorPlanId: row.floor_plan_id,
    facadeId: row.facade_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  const totalRecords = parseInt(countResult.rows[0].count, 10);
  const totalPages = Math.ceil(totalRecords / limit);

  return {
    mappings: keysToCamelCase(mappings),
    pagination: {
      currentPage: page,
      totalPages,
      totalRecords,
      limit,
    },
  };
}

/**
 * DELETE FLOOR PLAN FACADE MAP
 */
async function deleteFloorPlanFacadeMap(currentUser, id) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const builderId = currentUser.builder_id;
    const companyId = currentUser.company_id;

    const existingCheck = await client.query(
      `
      SELECT fpfm.id
      FROM floor_plan_facade_map fpfm
      INNER JOIN floor_plan fp ON fp.floor_plan_id = fpfm.floor_plan_id
      INNER JOIN facade f ON f.facade_id = fpfm.facade_id
      WHERE fpfm.id = $1
        AND (fp.company_id = $2 OR fp.builder_id = $3)
        AND (f.company_id = $2 OR f.builder_id = $3)
      `,
      [id, companyId, builderId],
    );

    if (existingCheck.rows.length === 0) {
      throw {
        status: 404,
        message:
          "Floor plan facade mapping not found or does not belong to your organization",
      };
    }

    await client.query("DELETE FROM floor_plan_facade_map WHERE id = $1", [id]);

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  createFloorPlanFacadeMap,
  getFloorPlanFacadeMaps,
  deleteFloorPlanFacadeMap,
};
