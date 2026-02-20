const getPool = require("../config/database");
const { successResponse, errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.createHouseLandPackage = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const {
      title,
      range_id,
      dwelling_type_id,
      template_id,
      contact_id,
      contact_show_pdf,
      lot_id,
      price_type,
      price_total,
      commission_total,
      house_total,
      floor_plan_id,
      floor_plan_description,
      facade_id,
      package_group_id,
      package_description,
      house_feature_id,
      disclaimer_type,
      disclaimer_description,
      attach_files,
    } = req.body;

    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.users_id;

    if (!userId || (!builderId && !companyId)) {
      return errorResponse(
        res,
        401,
        "Unauthorized: User must belong to either a builder or company",
      );
    }

    await client.query("BEGIN");

    // Validate lot ownership if provided
    if (lot_id) {
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
        return errorResponse(
          res,
          400,
          "Invalid lot_id or lot not found for your organization.",
        );
      }
    }

    // Validate contact ownership if provided
    if (contact_id) {
      const contactCheck = await client.query(
        `SELECT users_id FROM users 
         WHERE users_id = $1 AND (
           (company_id = $2 AND $2 IS NOT NULL)
           OR (builder_id = $3 AND $3 IS NOT NULL)
         ) LIMIT 1`,
        [contact_id, companyId, builderId],
      );

      if (contactCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "Invalid contact_id or contact not found for your organization.",
        );
      }
    }

    const sql = `
      INSERT INTO house_land_package (
        company_id,
        builder_id,
        title,
        range_id,
        dwelling_type_id,
        template_id,
        contact_id,
        contact_show_pdf,
        lot_id,
        price_type,
        price_total,
        commission_total,
        house_total,
        floor_plan_id,
        floor_plan_description,
        facade_id,
        package_group_id,
        package_description,
        house_feature_id,
        disclaimer_type,
        disclaimer_description,
        attach_files,
        created_by,
        updated_by,
        created_at,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      ) RETURNING *
    `;

    const values = [
      companyId,
      builderId,
      title,
      range_id || null,
      dwelling_type_id || null,
      template_id || null,
      contact_id || null,
      contact_show_pdf || false,
      lot_id || null,
      price_type || "estimate",
      price_total || 0,
      commission_total || 0,
      house_total || 0,
      floor_plan_id || null,
      floor_plan_description || null,
      facade_id || null,
      package_group_id || [],
      package_description || null,
      house_feature_id || null,
      disclaimer_type || null,
      disclaimer_description || null,
      attach_files || null,
      userId,
      userId,
    ];

    const result = await client.query(sql, values);
    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "House land package created successfully",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Create house land package error:", error);
    return errorResponse(res, 500, "Internal server error");
  } finally {
    client.release();
  }
};

exports.getAllHouseLandPackages = async (req, res) => {
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
      range_id,
      dwelling_type_id,
      template_id,
      contact_id,
      price_type,
      search,
    } = req.query;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const offset = (pageNum - 1) * limitNum;

    let whereConditions = [];
    let queryParams = [];
    let paramIndex = 1;

    // Add scope condition based on user type
    if (builderId) {
      whereConditions.push(`builder_id = $${paramIndex++}`);
      queryParams.push(builderId);
    } else if (companyId) {
      whereConditions.push(`company_id = $${paramIndex++}`);
      queryParams.push(companyId);
    }

    // Build WHERE conditions
    if (lot_id) {
      whereConditions.push(`lot_id = $${paramIndex++}`);
      queryParams.push(lot_id);
    }

    if (range_id) {
      whereConditions.push(`range_id = $${paramIndex++}`);
      queryParams.push(range_id);
    }

    if (dwelling_type_id) {
      whereConditions.push(`dwelling_type_id = $${paramIndex++}`);
      queryParams.push(dwelling_type_id);
    }

    if (template_id) {
      whereConditions.push(`template_id = $${paramIndex++}`);
      queryParams.push(template_id);
    }

    if (contact_id) {
      whereConditions.push(`contact_id = $${paramIndex++}`);
      queryParams.push(contact_id);
    }

    if (price_type) {
      whereConditions.push(`price_type = $${paramIndex++}`);
      queryParams.push(price_type);
    }

    if (search) {
      whereConditions.push(`(title ILIKE $${paramIndex++} OR package_description ILIKE $${paramIndex++})`);
      queryParams.push(`%${search}%`, `%${search}%`);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const countResult = await client.query(
      `SELECT COUNT(*) AS total FROM house_land_package ${whereClause}`,
      queryParams,
    );

    const total = parseInt(countResult.rows[0].total, 10);
    const totalPages = Math.ceil(total / limitNum);

    const result = await client.query(
      `SELECT * FROM house_land_package 
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...queryParams, limitNum, offset],
    );

    return successResponse(res, {
      houseLandPackages: keysToCamelCase(result.rows),
      pagination: {
        totalRecords: total,
        currentPage: pageNum,
        limit: limitNum,
        totalPages: totalPages,
      },
    });
  } catch (error) {
    console.error("Get all house land packages error:", error);
    return errorResponse(res, 500, "Internal server error");
  } finally {
    client.release();
  }
};

exports.getHouseLandPackageById = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { house_land_package_id } = req.params;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId && !companyId) {
      return errorResponse(res, 401, "Unauthorized: User must belong to either a builder or company");
    }

    const sql = `SELECT * FROM house_land_package WHERE house_land_package_id = $1 AND (
      (company_id = $2 AND $2 IS NOT NULL)
      OR (builder_id = $3 AND $3 IS NOT NULL)
    )`;
    const result = await client.query(sql, [house_land_package_id, companyId, builderId]);

    if (result.rows.length === 0) {
      return errorResponse(res, 404, "House land package not found");
    }

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "House land package retrieved successfully",
    );
  } catch (error) {
    console.error("Get house land package by ID error:", error);
    return errorResponse(res, 500, "Internal server error");
  } finally {
    client.release();
  }
};

exports.updateHouseLandPackage = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { house_land_package_id } = req.params;
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

    const checkSql = `SELECT * FROM house_land_package WHERE house_land_package_id = $1 AND (
      (company_id = $2 AND $2 IS NOT NULL)
      OR (builder_id = $3 AND $3 IS NOT NULL)
    )`;
    const checkResult = await client.query(checkSql, [house_land_package_id, companyId, builderId]);

    if (checkResult.rows.length === 0) {
      return errorResponse(res, 404, "House land package not found");
    }

    await client.query("BEGIN");

    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;

    const allowedFields = [
      "title",
      "range_id",
      "dwelling_type_id",
      "template_id",
      "contact_id",
      "contact_show_pdf",
      "lot_id",
      "price_type",
      "price_total",
      "commission_total",
      "house_total",
      "floor_plan_id",
      "floor_plan_description",
      "facade_id",
      "package_group_id",
      "package_description",
      "house_feature_id",
      "disclaimer_type",
      "disclaimer_description",
      "attach_files",
    ];

    const restrictedFields = [
      "company_id",
      "builder_id",
      "created_by",
      "created_at",
    ];
    const attemptedRestrictedUpdates = restrictedFields.filter(
      (field) => req.body[field] !== undefined,
    );

    if (attemptedRestrictedUpdates.length > 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        `Cannot update restricted fields: ${attemptedRestrictedUpdates.join(", ")}`,
      );
    }

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateFields.push(`${field} = $${paramIndex++}`);
        updateValues.push(req.body[field]);
      }
    }

    if (updateFields.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "No valid fields to update");
    }

    updateFields.push(`updated_by = $${paramIndex++}`);
    updateValues.push(userId);

    const sql = `
      UPDATE house_land_package 
      SET ${updateFields.join(", ")}, updated_at = CURRENT_TIMESTAMP
      WHERE house_land_package_id = $${paramIndex++}
      RETURNING *
    `;

    updateValues.push(house_land_package_id);

    const result = await client.query(sql, updateValues);
    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "House land package updated successfully",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Update house land package error:", error);
    return errorResponse(res, 500, "Internal server error");
  } finally {
    client.release();
  }
};

exports.deleteHouseLandPackage = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { house_land_package_id } = req.params;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId && !companyId) {
      return errorResponse(res, 401, "Unauthorized: User must belong to either a builder or company");
    }

    const checkSql = `SELECT * FROM house_land_package WHERE house_land_package_id = $1 AND (
      (company_id = $2 AND $2 IS NOT NULL)
      OR (builder_id = $3 AND $3 IS NOT NULL)
    )`;
    const checkResult = await client.query(checkSql, [house_land_package_id, companyId, builderId]);

    if (checkResult.rows.length === 0) {
      return errorResponse(res, 404, "House land package not found");
    }

    await client.query("BEGIN");

    const sql = "DELETE FROM house_land_package WHERE house_land_package_id = $1 RETURNING *";
    const result = await client.query(sql, [house_land_package_id]);
    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "House land package deleted successfully",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Delete house land package error:", error);
    return errorResponse(res, 500, "Internal server error");
  } finally {
    client.release();
  }
};