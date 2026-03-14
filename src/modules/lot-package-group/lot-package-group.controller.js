const getPool = require("../../config/database");
const { successResponse, errorResponse } = require("../../helper/response");
const { keysToCamelCase } = require("../../utils/common");

exports.createLotPackageGroup = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { group_name } = req.body;
    const userId = req.user?.users_id;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!userId || (!builderId && !companyId)) {
      return errorResponse(
        res,
        401,
        "Unauthorized: User must belong to either a builder or company",
      );
    }

    await client.query("BEGIN");

    const dupCheck = await client.query(
      `SELECT lot_package_group_id FROM lot_package_group 
       WHERE LOWER(group_name) = LOWER($1) AND (
         (company_id = $2 AND $2 IS NOT NULL)
         OR (builder_id = $3 AND $3 IS NOT NULL)
       ) LIMIT 1`,
      [group_name, companyId, builderId],
    );

    if (dupCheck.rowCount > 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "Group name already exists in your organization.");
    }

    const sql = `
      INSERT INTO lot_package_group (
        company_id,
        builder_id,
        group_name,
        created_by,
        updated_by,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
    `;

    const result = await client.query(sql, [companyId, builderId, group_name, userId]);
    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Lot package group created successfully",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Create lot package group error:", error);
    return errorResponse(res, 500, "Internal server error");
  } finally {
    client.release();
  }
};

exports.getAllLotPackageGroups = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId && !companyId) {
      return errorResponse(res, 401, "Unauthorized: User must belong to either a builder or company");
    }

    const { page = 1, limit = 25, search } = req.query;
    const offset = (page - 1) * limit;

    let whereConditions = [];
    let queryParams = [];
    let paramIndex = 1;

    if (builderId) {
      whereConditions.push(`builder_id = $${paramIndex++}`);
      queryParams.push(builderId);
    } else if (companyId) {
      whereConditions.push(`company_id = $${paramIndex++}`);
      queryParams.push(companyId);
    }

    if (search) {
      whereConditions.push(`group_name ILIKE $${paramIndex++}`);
      queryParams.push(`%${search}%`);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(" AND ")}` : "";

    const countSql = `SELECT COUNT(*) as total FROM lot_package_group ${whereClause}`;
    const countResult = await client.query(countSql, queryParams);
    const total = parseInt(countResult.rows[0].total);

    const dataSql = `
      SELECT * FROM lot_package_group 
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;
    queryParams.push(parseInt(limit), offset);

    const dataResult = await client.query(dataSql, queryParams);

    return successResponse(
      res,
      {
        groups: dataResult.rows.map(keysToCamelCase),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
      "Lot package groups retrieved successfully",
    );
  } catch (error) {
    console.error("Get all lot package groups error:", error);
    return errorResponse(res, 500, "Internal server error");
  } finally {
    client.release();
  }
};

exports.getLotPackageGroupById = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { lot_package_group_id } = req.params;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId && !companyId) {
      return errorResponse(res, 401, "Unauthorized: User must belong to either a builder or company");
    }

    const sql = `
      SELECT * FROM lot_package_group 
      WHERE lot_package_group_id = $1 AND (
        (company_id = $2 AND $2 IS NOT NULL)
        OR (builder_id = $3 AND $3 IS NOT NULL)
      )
    `;
    const result = await client.query(sql, [lot_package_group_id, companyId, builderId]);

    if (result.rows.length === 0) {
      return errorResponse(res, 404, "Lot package group not found");
    }

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Lot package group retrieved successfully",
    );
  } catch (error) {
    console.error("Get lot package group by ID error:", error);
    return errorResponse(res, 500, "Internal server error");
  } finally {
    client.release();
  }
};

exports.updateLotPackageGroup = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { lot_package_group_id } = req.params;
    const { group_name } = req.body;
    const userId = req.user?.users_id;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!userId || (!builderId && !companyId)) {
      return errorResponse(res, 401, "Unauthorized");
    }

    await client.query("BEGIN");

    const checkSql = `
      SELECT group_name FROM lot_package_group 
      WHERE lot_package_group_id = $1 AND (
        (company_id = $2 AND $2 IS NOT NULL)
        OR (builder_id = $3 AND $3 IS NOT NULL)
      )
    `;
    const checkResult = await client.query(checkSql, [lot_package_group_id, companyId, builderId]);

    if (checkResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Lot package group not found");
    }

    if (group_name && group_name !== checkResult.rows[0].group_name) {
      const dupCheck = await client.query(
        `SELECT lot_package_group_id FROM lot_package_group 
         WHERE LOWER(group_name) = LOWER($1) AND (
           (company_id = $2 AND $2 IS NOT NULL)
           OR (builder_id = $3 AND $3 IS NOT NULL)
         ) AND lot_package_group_id != $4 LIMIT 1`,
        [group_name, companyId, builderId, lot_package_group_id],
      );

      if (dupCheck.rowCount > 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Group name already exists in your organization.");
      }
    }

    const sql = `
      UPDATE lot_package_group 
      SET group_name = COALESCE($1, group_name),
          updated_by = $2,
          updated_at = CURRENT_TIMESTAMP
      WHERE lot_package_group_id = $3
      RETURNING *
    `;

    const result = await client.query(sql, [group_name, userId, lot_package_group_id]);
    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Lot package group updated successfully",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Update lot package group error:", error);
    return errorResponse(res, 500, "Internal server error");
  } finally {
    client.release();
  }
};

exports.deleteLotPackageGroup = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { lot_package_group_id } = req.params;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId && !companyId) {
      return errorResponse(res, 401, "Unauthorized");
    }

    await client.query("BEGIN");

    const checkSql = `
      SELECT lot_package_group_id FROM lot_package_group 
      WHERE lot_package_group_id = $1 AND (
        (company_id = $2 AND $2 IS NOT NULL)
        OR (builder_id = $3 AND $3 IS NOT NULL)
      )
    `;
    const checkResult = await client.query(checkSql, [lot_package_group_id, companyId, builderId]);

    if (checkResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Lot package group not found");
    }

    await client.query("DELETE FROM lot_package_group WHERE lot_package_group_id = $1", [lot_package_group_id]);
    await client.query("COMMIT");

    return successResponse(res, {}, "Lot package group deleted successfully");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Delete lot package group error:", error);
    return errorResponse(res, 500, "Internal server error");
  } finally {
    client.release();
  }
};
