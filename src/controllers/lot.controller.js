const getPool = require("../config/database");
const { successResponse, errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.createLot = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const userId = req.user?.users_id;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!userId || !builderId) {
      return errorResponse(
        res,
        401,
        "Unauthorized: User or builder ID missing",
      );
    }

    const {
      estate_id,
      estate_stage_id,
      lot_number,
      street,
      city,
      state_id,
      zip_code,
      title_status,
      title_date,
      lost_type,
      corner_block,
      width_m,
      depth_m,
      size_m2,
      price,
      site_fall_mm,
      land_fill_mm,
      total_size_m2,
    } = req.body;

    await client.query("BEGIN");


    if (estate_id) {
      const estateCheck = await client.query(
        "SELECT estate_id FROM estate WHERE estate_id = $1 AND builder_id = $2 LIMIT 1",
        [estate_id, builderId],
      );

      if (estateCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          `Invalid estate_id or estate not found for this builder.`,
        );
      }
    }

    if (estate_stage_id) {
      const estateStageCheck = await client.query(
        `SELECT es.estate_stage_id, es.estate_id, e.builder_id, e.company_id 
         FROM estate_stages es
         JOIN estate e ON e.estate_id = es.estate_id
         WHERE es.estate_stage_id = $1 AND e.builder_id = $2 LIMIT 1`,
        [estate_stage_id, builderId],
      );

      if (estateStageCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          `Invalid estate_stage_id or estate stage not found.`,
        );
      }

      const stageEstateId = estateStageCheck.rows[0].estate_id;
      if (estate_id && stageEstateId !== estate_id) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          `Estate stage does not belong to the provided estate.`,
        );
      }
    }

    const sql = `
      INSERT INTO lot (
        company_id,
        builder_id,
        estate_id,
        estate_stage_id,
        lot_number,
        street,
        city,
        state_id,
        zip_code,
        title_status,
        title_date,
        lost_type,
        corner_block,
        width_m,
        depth_m,
        size_m2,
        price,
        site_fall_mm,
        land_fill_mm,
        total_size_m2,
        created_by,
        updated_by,
        created_at,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,$18,$19,$20,$21,$22, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      ) RETURNING *
    `;

    const values = [
      companyId,
      builderId,
      estate_id || null,
      estate_stage_id || null,
      lot_number,
      street,
      city,
      state_id || null,
      zip_code,
      title_status || null,
      title_date || null,
      lost_type || "regular",
      corner_block || false,
      width_m || null,
      depth_m || null,
      size_m2 || null,
      price || null,
      site_fall_mm || null,
      land_fill_mm || null,
      total_size_m2 || null,
      userId,
      userId
    ];

    const result = await client.query(sql, values);
    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Lot created successfully",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Create lot error:", error);
    return errorResponse(res, 500, "Internal server error");
  } finally {
    client.release();
  }
};

exports.getAllLots = async (req, res) => {
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
      estate_id,
      estate_stage_id,
      title_status,
      lost_type,
      corner_block,
      min_price,
      max_price,
      min_size,
      max_size,
      search,
    } = req.query;

    const offset = (page - 1) * limit;
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
    if (estate_id) {
      whereConditions.push(`estate_id = $${paramIndex++}`);
      queryParams.push(estate_id);
    }

    if (estate_stage_id) {
      whereConditions.push(`estate_stage_id = $${paramIndex++}`);
      queryParams.push(estate_stage_id);
    }

    if (title_status) {
      whereConditions.push(`title_status = $${paramIndex++}`);
      queryParams.push(title_status);
    }

    if (lost_type) {
      whereConditions.push(`lost_type = $${paramIndex++}`);
      queryParams.push(lost_type);
    }

    if (corner_block !== undefined) {
      whereConditions.push(`corner_block = $${paramIndex++}`);
      queryParams.push(corner_block === "true");
    }

    if (min_price) {
      whereConditions.push(`price >= $${paramIndex++}`);
      queryParams.push(parseFloat(min_price));
    }

    if (max_price) {
      whereConditions.push(`price <= $${paramIndex++}`);
      queryParams.push(parseFloat(max_price));
    }

    if (min_size) {
      whereConditions.push(`size_m2 >= $${paramIndex++}`);
      queryParams.push(parseFloat(min_size));
    }

    if (max_size) {
      whereConditions.push(`size_m2 <= $${paramIndex++}`);
      queryParams.push(parseFloat(max_size));
    }

    if (search) {
      whereConditions.push(`(
        lot_number ILIKE $${paramIndex++} OR
        street ILIKE $${paramIndex++} OR
        city ILIKE $${paramIndex++} OR
        zip_code ILIKE $${paramIndex++}
      )`);
      const searchTerm = `%${search}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    const whereClause =
      whereConditions.length > 0
        ? `WHERE ${whereConditions.join(" AND ")}`
        : "";

    // Get total count
    const countSql = `SELECT COUNT(*) as total FROM lot ${whereClause}`;
    const countResult = await client.query(countSql, queryParams);
    const total = parseInt(countResult.rows[0].total);

    // Get paginated results
    const dataSql = `
      SELECT * FROM lot 
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;
    queryParams.push(parseInt(limit), offset);

    const dataResult = await client.query(dataSql, queryParams);

    return successResponse(
      res,
      {
        lots: dataResult.rows.map(keysToCamelCase),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
      "Lots retrieved successfully",
    );
  } catch (error) {
    console.error("Get all lots error:", error);
    return errorResponse(res, 500, "Internal server error");
  } finally {
    client.release();
  }
};

exports.getLotById = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { lot_id } = req.params;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId && !companyId) {
      return errorResponse(res, 401, "Unauthorized: User must belong to either a builder or company");
    }

    const sql = `SELECT * FROM lot WHERE lot_id = $1 AND (
      (company_id = $2 AND $2 IS NOT NULL)
      OR (builder_id = $3 AND $3 IS NOT NULL)
    )`;
    const result = await client.query(sql, [lot_id, companyId, builderId]);

    if (result.rows.length === 0) {
      return successResponse(res, "Lot retrieved successfully.");
    }

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Lot retrieved successfully",
    );
  } catch (error) {
    console.error("Get lot by ID error:", error);
    return errorResponse(res, 500, "Internal server error");
  } finally {
    client.release();
  }
};

exports.updateLot = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { lot_id } = req.params;
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

    const checkSql = `SELECT * FROM lot WHERE lot_id = $1 AND (
      (company_id = $2 AND $2 IS NOT NULL)
      OR (builder_id = $3 AND $3 IS NOT NULL)
    )`;
    const checkResult = await client.query(checkSql, [lot_id, companyId, builderId]);

    if (checkResult.rows.length === 0) {
      return errorResponse(res, 404, "Lot not found");
    }

    await client.query("BEGIN");

    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;

    const allowedFields = [
      "lot_number",
      "street",
      "city",
      "state_id",
      "zip_code",
      "title_status",
      "title_date",
      "lost_type",
      "corner_block",
      "width_m",
      "depth_m",
      "size_m2",
      "price",
      "site_fall_mm",
      "land_fill_mm",
      "total_size_m2",
    ];

    const restrictedFields = [
      "estate_id",
      "estate_stage_id",
    ];
    const attemptedRestrictedUpdates = restrictedFields.filter(
      (field) => req.body[field] !== undefined,
    );

    if (attemptedRestrictedUpdates.length > 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        `Cannot update the following fields: ${attemptedRestrictedUpdates.join(
          ", ",
        )}. These fields are restricted.`,
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

    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    updateValues.push(lot_id);

    const sql = `
      UPDATE lot 
      SET ${updateFields.join(", ")}
      WHERE lot_id = $${paramIndex}
      RETURNING *
    `;

    const result = await client.query(sql, updateValues);
    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Lot updated successfully",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Update lot error:", error);
    return errorResponse(res, 500, "Internal server error");
  } finally {
    client.release();
  }
};

exports.deleteLot = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { lot_id } = req.params;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId && !companyId) {
      return errorResponse(res, 401, "Unauthorized: User must belong to either a builder or company");
    }

    const checkSql = `SELECT * FROM lot WHERE lot_id = $1 AND (
      (company_id = $2 AND $2 IS NOT NULL)
      OR (builder_id = $3 AND $3 IS NOT NULL)
    )`;
    const checkResult = await client.query(checkSql, [lot_id, companyId, builderId]);

    if (checkResult.rows.length === 0) {
      return errorResponse(res, 404, "Lot not found");
    }

    await client.query("BEGIN");

    const sql = "DELETE FROM lot WHERE lot_id = $1 RETURNING *";
    const result = await client.query(sql, [lot_id]);
    await client.query("COMMIT");

    return successResponse(
      res,
      "Lot deleted successfully",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Delete lot error:", error);
    return errorResponse(res, 500, "Internal server error");
  } finally {
    client.release();
  }
};
