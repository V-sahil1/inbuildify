const getPool = require("../config/database");
const { successResponse, errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.createLotPackage = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const {
      lot_id,
      package_name,
      dwelling_type_id,
      range_id,
      lot_package_group_id,
      disclaimer,
      floor_plan_id,
      facade_id,
    } = req.body;

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

    const lotCheck = await client.query(
      `SELECT lot_id FROM lot 
       WHERE lot_id = $1 AND (
         (company_id = $2 AND $2 IS NOT NULL)
         OR (builder_id = $3 AND $3 IS NOT NULL)
       ) LIMIT 1`,
      [lot_id, companyId, builderId],
    );

    if (lotCheck.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Lot not found or unauthorized access.");
    }

    const dupCheck = await client.query(
      `SELECT lp.lot_package_id FROM lot_package lp
       JOIN lot l ON l.lot_id = lp.lot_id
       WHERE LOWER(lp.package_name) = LOWER($1) AND (
         (l.company_id = $2 AND $2 IS NOT NULL)
         OR (l.builder_id = $3 AND $3 IS NOT NULL)
       ) LIMIT 1`,
      [package_name, companyId, builderId],
    );

    if (dupCheck.rowCount > 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "Package name already exists in your organization.");
    }

    if (dwelling_type_id) {
      const dtCheck = await client.query(
        `SELECT dwelling_type_id FROM dwelling_type 
         WHERE dwelling_type_id = $1 AND is_active = true AND (
           (company_id = $2 AND $2 IS NOT NULL)
           OR (builder_id = $3 AND $3 IS NOT NULL)
         ) LIMIT 1`,
        [dwelling_type_id, companyId, builderId],
      );
      if (dtCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Invalid or inactive dwelling type.");
      }
    }

    if (range_id) {
      const rCheck = await client.query(
        `SELECT range_id FROM range 
         WHERE range_id = $1 AND is_active = true AND (
           (company_id = $2 AND $2 IS NOT NULL)
           OR (builder_id = $3 AND $3 IS NOT NULL)
         ) LIMIT 1`,
        [range_id, companyId, builderId],
      );
      if (rCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Invalid or inactive range.");
      }
    }

    if (lot_package_group_id) {
      const lpgCheck = await client.query(
        `SELECT lot_package_group_id FROM lot_package_group 
         WHERE lot_package_group_id = $1 AND (
           (company_id = $2 AND $2 IS NOT NULL)
           OR (builder_id = $3 AND $3 IS NOT NULL)
         ) LIMIT 1`,
        [lot_package_group_id, companyId, builderId],
      );
      if (lpgCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Invalid lot package group.");
      }
    }

    if (facade_id) {
      const fCheck = await client.query(
        `SELECT facade_id, dwelling_type_id FROM facade 
         WHERE facade_id = $1 AND status = true AND (
           (company_id = $2 AND $2 IS NOT NULL)
           OR (builder_id = $3 AND $3 IS NOT NULL)
         ) LIMIT 1`,
        [facade_id, companyId, builderId],
      );
      if (fCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Invalid or inactive facade.");
      }
      if (fCheck.rows[0].dwelling_type_id !== dwelling_type_id) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Facade does not match the provided dwelling type.");
      }
    }

    if (floor_plan_id) {
      const fpCheck = await client.query(
        `SELECT floor_plan_id, dwelling_type_id FROM floor_plan 
         WHERE floor_plan_id = $1 AND status = true AND (
           (company_id = $2 AND $2 IS NOT NULL)
           OR (builder_id = $3 AND $3 IS NOT NULL)
         ) LIMIT 1`,
        [floor_plan_id, companyId, builderId],
      );
      if (fpCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Invalid or inactive floor plan.");
      }
      if (fpCheck.rows[0].dwelling_type_id !== dwelling_type_id) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Floor plan does not match the provided dwelling type.");
      }
    }

    const sql = `
      INSERT INTO lot_package (
        lot_id,
        package_name,
        dwelling_type_id,
        range_id,
        lot_package_group_id,
        disclaimer,
        floor_plan_id,
        facade_id,
        created_by,
        updated_by,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
    `;

    const values = [
      lot_id,
      package_name,
      dwelling_type_id || null,
      range_id || null,
      lot_package_group_id || null,
      disclaimer || null,
      floor_plan_id || null,
      facade_id || null,
      userId,
    ];

    const result = await client.query(sql, values);
    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Lot package created successfully",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Create lot package error:", error);
    return errorResponse(res, 500, "Internal server error");
  } finally {
    client.release();
  }
};

exports.getAllLotPackages = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId && !companyId) {
      return errorResponse(res, 401, "Unauthorized: User must belong to either a builder or company");
    }

    const {
      page = 1,
      limit = 25,
      lot_id,
      dwelling_type_id,
      range_id,
      lot_package_group_id,
      search,
    } = req.query;
    const offset = (page - 1) * limit;

    let whereConditions = [];
    let queryParams = [];
    let paramIndex = 1;

    whereConditions.push(`(
      (l.company_id = $${paramIndex++} AND $${paramIndex - 1} IS NOT NULL)
      OR (l.builder_id = $${paramIndex++} AND $${paramIndex - 1} IS NOT NULL)
    )`);
    queryParams.push(companyId, builderId);

    if (lot_id) {
      whereConditions.push(`lp.lot_id = $${paramIndex++}`);
      queryParams.push(lot_id);
    }

    if (dwelling_type_id) {
      whereConditions.push(`lp.dwelling_type_id = $${paramIndex++}`);
      queryParams.push(dwelling_type_id);
    }

    if (range_id) {
      whereConditions.push(`lp.range_id = $${paramIndex++}`);
      queryParams.push(range_id);
    }

    if (lot_package_group_id) {
      whereConditions.push(`lp.lot_package_group_id = $${paramIndex++}`);
      queryParams.push(lot_package_group_id);
    }

    if (search) {
      whereConditions.push(`lp.package_name ILIKE $${paramIndex++}`);
      queryParams.push(`%${search}%`);
    }

    const whereClause = `WHERE ${whereConditions.join(" AND ")}`;

    const countSql = `
      SELECT COUNT(*) as total 
      FROM lot_package lp
      JOIN lot l ON l.lot_id = lp.lot_id
      ${whereClause}
    `;
    const countResult = await client.query(countSql, queryParams);
    const total = parseInt(countResult.rows[0].total);

    const dataSql = `
      SELECT lp.*, 
             l.lot_number,
             dt.name as dwelling_type_name,
             r.name as range_name,
             lpg.group_name as lot_package_group_name,
             fp.name as floor_plan_name,
             f.name as facade_name
      FROM lot_package lp
      JOIN lot l ON l.lot_id = lp.lot_id
      LEFT JOIN dwelling_type dt ON dt.dwelling_type_id = lp.dwelling_type_id
      LEFT JOIN range r ON r.range_id = lp.range_id
      LEFT JOIN lot_package_group lpg ON lpg.lot_package_group_id = lp.lot_package_group_id
      LEFT JOIN floor_plan fp ON fp.floor_plan_id = lp.floor_plan_id
      LEFT JOIN facade f ON f.facade_id = lp.facade_id
      ${whereClause}
      ORDER BY lp.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;
    queryParams.push(parseInt(limit), offset);

    const dataResult = await client.query(dataSql, queryParams);

    return successResponse(
      res,
      {
        packages: dataResult.rows.map(keysToCamelCase),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
      "Lot packages retrieved successfully",
    );
  } catch (error) {
    console.error("Get all lot packages error:", error);
    return errorResponse(res, 500, "Internal server error");
  } finally {
    client.release();
  }
};

exports.getLotPackageById = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { lot_package_id } = req.params;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId && !companyId) {
      return errorResponse(res, 401, "Unauthorized");
    }

    const sql = `
      SELECT lp.*, 
             l.lot_number,
             dt.name as dwelling_type_name,
             r.name as range_name,
             lpg.group_name as lot_package_group_name,
             fp.name as floor_plan_name,
             f.name as facade_name
      FROM lot_package lp
      JOIN lot l ON l.lot_id = lp.lot_id
      LEFT JOIN dwelling_type dt ON dt.dwelling_type_id = lp.dwelling_type_id
      LEFT JOIN range r ON r.range_id = lp.range_id
      LEFT JOIN lot_package_group lpg ON lpg.lot_package_group_id = lp.lot_package_group_id
      LEFT JOIN floor_plan fp ON fp.floor_plan_id = lp.floor_plan_id
      LEFT JOIN facade f ON f.facade_id = lp.facade_id
      WHERE lp.lot_package_id = $1 AND (
        (l.company_id = $2 AND $2 IS NOT NULL)
        OR (l.builder_id = $3 AND $3 IS NOT NULL)
      )
    `;
    const result = await client.query(sql, [lot_package_id, companyId, builderId]);

    if (result.rows.length === 0) {
      return errorResponse(res, 404, "Lot package not found");
    }

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Lot package retrieved successfully",
    );
  } catch (error) {
    console.error("Get lot package by ID error:", error);
    return errorResponse(res, 500, "Internal server error");
  } finally {
    client.release();
  }
};

exports.updateLotPackage = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { lot_package_id } = req.params;
    const userId = req.user?.users_id;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!userId || (!builderId && !companyId)) {
      return errorResponse(res, 401, "Unauthorized");
    }

    await client.query("BEGIN");

    const checkSql = `
      SELECT lp.lot_id, lp.dwelling_type_id, lp.facade_id, lp.floor_plan_id 
      FROM lot_package lp
      JOIN lot l ON l.lot_id = lp.lot_id
      WHERE lp.lot_package_id = $1 AND (
        (l.company_id = $2 AND $2 IS NOT NULL)
        OR (l.builder_id = $3 AND $3 IS NOT NULL)
      )
    `;
    const checkResult = await client.query(checkSql, [lot_package_id, companyId, builderId]);

    if (checkResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Lot package not found");
    }

    const currentPackage = checkResult.rows[0];
    const targetDwellingTypeId = req.body.dwelling_type_id || currentPackage.dwelling_type_id;

    if (req.body.lot_id !== undefined && req.body.lot_id !== checkResult.rows[0].lot_id) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "lot_id cannot be updated");
    }

    if (req.body.package_name && req.body.package_name !== currentPackage.package_name) {
      const dupCheck = await client.query(
        `SELECT lp.lot_package_id FROM lot_package lp
         JOIN lot l ON l.lot_id = lp.lot_id
         WHERE LOWER(lp.package_name) = LOWER($1) AND (
           (l.company_id = $2 AND $2 IS NOT NULL)
           OR (l.builder_id = $3 AND $3 IS NOT NULL)
         ) AND lp.lot_package_id != $4 LIMIT 1`,
        [req.body.package_name, companyId, builderId, lot_package_id],
      );

      if (dupCheck.rowCount > 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Package name already exists in your organization.");
      }
    }

    if (req.body.dwelling_type_id) {
      const dtCheck = await client.query(
        `SELECT dwelling_type_id FROM dwelling_type 
         WHERE dwelling_type_id = $1 AND is_active = true AND (
           (company_id = $2 AND $2 IS NOT NULL)
           OR (builder_id = $3 AND $3 IS NOT NULL)
         ) LIMIT 1`,
        [req.body.dwelling_type_id, companyId, builderId],
      );
      if (dtCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Invalid or inactive dwelling type.");
      }
    }

    if (req.body.range_id) {
      const rCheck = await client.query(
        `SELECT range_id FROM range 
         WHERE range_id = $1 AND is_active = true AND (
           (company_id = $2 AND $2 IS NOT NULL)
           OR (builder_id = $3 AND $3 IS NOT NULL)
         ) LIMIT 1`,
        [req.body.range_id, companyId, builderId],
      );
      if (rCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Invalid or inactive range.");
      }
    }

    if (req.body.lot_package_group_id) {
      const lpgCheck = await client.query(
        `SELECT lot_package_group_id FROM lot_package_group 
         WHERE lot_package_group_id = $1 AND (
           (company_id = $2 AND $2 IS NOT NULL)
           OR (builder_id = $3 AND $3 IS NOT NULL)
         ) LIMIT 1`,
        [req.body.lot_package_group_id, companyId, builderId],
      );
      if (lpgCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Invalid lot package group.");
      }
    }

    const finalFacadeId = req.body.facade_id !== undefined ? req.body.facade_id : currentPackage.facade_id;
    if (finalFacadeId) {
      const fCheck = await client.query(
        `SELECT facade_id, dwelling_type_id FROM facade 
         WHERE facade_id = $1 AND status = true AND (
           (company_id = $2 AND $2 IS NOT NULL)
           OR (builder_id = $3 AND $3 IS NOT NULL)
         ) LIMIT 1`,
        [finalFacadeId, companyId, builderId],
      );
      if (fCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Invalid or inactive facade.");
      }
      if (fCheck.rows[0].dwelling_type_id !== targetDwellingTypeId) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Facade does not match the dwelling type.");
      }
    }

    const finalFloorPlanId = req.body.floor_plan_id !== undefined ? req.body.floor_plan_id : currentPackage.floor_plan_id;
    if (finalFloorPlanId) {
      const fpCheck = await client.query(
        `SELECT floor_plan_id, dwelling_type_id FROM floor_plan 
         WHERE floor_plan_id = $1 AND status = true AND (
           (company_id = $2 AND $2 IS NOT NULL)
           OR (builder_id = $3 AND $3 IS NOT NULL)
         ) LIMIT 1`,
        [finalFloorPlanId, companyId, builderId],
      );
      if (fpCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Invalid or inactive floor plan.");
      }
      if (fpCheck.rows[0].dwelling_type_id !== targetDwellingTypeId) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Floor plan does not match the dwelling type.");
      }
    }

    const allowedFields = [
      "package_name",
      "dwelling_type_id",
      "range_id",
      "lot_package_group_id",
      "disclaimer",
      "floor_plan_id",
      "facade_id",
    ];

    let updateFields = [];
    let updateValues = [];
    let paramIndex = 1;

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateFields.push(`${field} = $${paramIndex++}`);
        updateValues.push(req.body[field] || null);
      }
    }

    if (updateFields.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "No valid fields to update");
    }

    updateFields.push(`updated_by = $${paramIndex++}`);
    updateValues.push(userId);

    updateFields.push("updated_at = CURRENT_TIMESTAMP");

    const sql = `
      UPDATE lot_package 
      SET ${updateFields.join(", ")}
      WHERE lot_package_id = $${paramIndex}
      RETURNING *
    `;
    updateValues.push(lot_package_id);

    const result = await client.query(sql, updateValues);
    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Lot package updated successfully",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Update lot package error:", error);
    return errorResponse(res, 500, "Internal server error");
  } finally {
    client.release();
  }
};

exports.deleteLotPackage = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { lot_package_id } = req.params;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId && !companyId) {
      return errorResponse(res, 401, "Unauthorized");
    }

    await client.query("BEGIN");

    const checkSql = `
      SELECT lp.lot_package_id FROM lot_package lp
      JOIN lot l ON l.lot_id = lp.lot_id
      WHERE lp.lot_package_id = $1 AND (
        (l.company_id = $2 AND $2 IS NOT NULL)
        OR (l.builder_id = $3 AND $3 IS NOT NULL)
      )
    `;
    const checkResult = await client.query(checkSql, [lot_package_id, companyId, builderId]);

    if (checkResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Lot package not found");
    }

    await client.query("DELETE FROM lot_package WHERE lot_package_id = $1", [lot_package_id]);
    await client.query("COMMIT");

    return successResponse(res, {}, "Lot package deleted successfully");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Delete lot package error:", error);
    return errorResponse(res, 500, "Internal server error");
  } finally {
    client.release();
  }
};
