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

    if (!userId || (!builderId && !companyId)) {
      return errorResponse(
        res,
        401,
        "Unauthorized: User must belong to either a builder or company",
      );
    }

    const {
      leads_id,
      estate_id,
      estate_stage_id,
      lot_number,
      street,
      city,
      state_id,
      zip_code,
      title_status,
      title_date,
      lot_type,
      corner_block,
      width_m,
      depth_m,
      price,
      site_fall_mm,
      land_fill_mm,
      total_size_m2,
    } = req.body;

    await client.query("BEGIN");

    if (leads_id) {
      const leadCheck = await client.query(
        `SELECT leads_id, lot_id FROM leads 
         WHERE leads_id = $1 AND (
           (company_id = $2 AND $2 IS NOT NULL)
           OR (builder_id = $3 AND $3 IS NOT NULL)
         ) LIMIT 1`,
        [leads_id, companyId, builderId],
      );

      if (leadCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "Invalid leads_id or lead not found for this organization.",
        );
      }

      // If lead exists and user is trying to create a new lot for it, 
      // delete the previous lot(s) associated with this lead
      await client.query(
        "DELETE FROM lot WHERE leads_id = $1",
        [leads_id]
      );
    }

    if (state_id) {
      const stateCheck = await client.query(
        "SELECT state_id FROM state WHERE state_id = $1 LIMIT 1",
        [state_id],
      );

      if (stateCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Invalid state_id.");
      }
    }

    if (estate_stage_id && !estate_id) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "estate_id is required when estate_stage_id is provided.",
      );
    }

    if (estate_id) {
      const estateCheck = await client.query(
        `SELECT estate_id FROM estate 
         WHERE estate_id = $1 AND (
           (company_id = $2 AND $2 IS NOT NULL)
           OR (builder_id = $3 AND $3 IS NOT NULL)
         ) AND status = true LIMIT 1`,
        [estate_id, companyId, builderId],
      );

      if (estateCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "Invalid estate_id or estate not found for this builder.",
        );
      }
    }

    if (estate_stage_id) {
      const estateStageCheck = await client.query(
        `SELECT es.estate_stage_id, es.estate_id 
         FROM estate_stages es
         JOIN estate e ON e.estate_id = es.estate_id
         WHERE es.estate_stage_id = $1 AND (
           (e.company_id = $2 AND $2 IS NOT NULL)
           OR (e.builder_id = $3 AND $3 IS NOT NULL)
         ) AND e.status = true LIMIT 1`,
        [estate_stage_id, companyId, builderId],
      );

      if (estateStageCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "Invalid estate_stage_id or estate stage not found.",
        );
      }

      const stageEstateId = estateStageCheck.rows[0].estate_id;
      if (stageEstateId !== estate_id) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "Estate stage does not belong to the provided estate.",
        );
      }
    }

    const duplicateCheck = await client.query(
      `SELECT lot_id FROM lot 
       WHERE lot_number = $1 AND (
         (company_id = $2 AND $2 IS NOT NULL)
         OR (builder_id = $3 AND $3 IS NOT NULL)
       ) LIMIT 1`,
      [lot_number, companyId, builderId],
    );

    if (duplicateCheck.rowCount > 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        `Lot number ${lot_number} already exists in this organization.`,
      );
    }

    const sql = `
      INSERT INTO lot (
        company_id,
        builder_id,
        leads_id,
        estate_id,
        estate_stage_id,
        lot_number,
        street,
        city,
        state_id,
        zip_code,
        title_status,
        title_date,
        lot_type,
        corner_block,
        width_m,
        depth_m,
        price,
        site_fall_mm,
        land_fill_mm,
        total_size_m2,
        created_by,
        updated_by,
        created_at,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      ) RETURNING 
        lot.*,
        (SELECT jsonb_build_object('id', e.estate_id, 'name', e.name) FROM estate e WHERE e.estate_id = lot.estate_id) AS estate,
        (SELECT jsonb_build_object('id', es.estate_stage_id, 'name', es.name) FROM estate_stages es WHERE es.estate_stage_id = lot.estate_stage_id) AS estate_stage,
        (SELECT u.name FROM users u WHERE u.users_id = lot.created_by) AS created_by_name
    `;

    const values = [
      companyId,
      builderId,
      leads_id || null,
      estate_id || null,
      estate_stage_id || null,
      lot_number,
      street,
      city,
      state_id || null,
      zip_code,
      title_status || null,
      title_date || null,
      lot_type || "regular",
      corner_block || false,
      width_m || null,
      depth_m || null,
      price || null,
      site_fall_mm || null,
      land_fill_mm || null,
      total_size_m2 || null,
      userId,
      userId
    ];

    const result = await client.query(sql, values);

    if (leads_id) {
      await client.query(
        "UPDATE leads SET lot_id = $1, updated_at = CURRENT_TIMESTAMP WHERE leads_id = $2",
        [result.rows[0].lot_id, leads_id]
      );
    }

    await client.query("COMMIT");

    const formatted = keysToCamelCase(result.rows[0]);
    delete formatted.estateId;
    delete formatted.estateStageId;

    return successResponse(
      res,
      formatted,
      "Lot created successfully",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Create lot error:", error);
    return errorResponse(res, 500, error.message || "Internal server error");
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
      lot_number,
      price,
      size,
      estate_name,
      stage_name,
      address,
      status,
      created_date,
      created_by,
    } = req.query;
    let whereConditions = [];
    let queryParams = [];
    let paramIndex = 1;

    whereConditions.push(`(
      (l.company_id = $${paramIndex++} AND $${paramIndex - 1} IS NOT NULL)
      OR (l.builder_id = $${paramIndex++} AND $${paramIndex - 1} IS NOT NULL)
    )`);
    queryParams.push(companyId, builderId);

    // Lot number filter
    if (lot_number) {
      whereConditions.push(`l.lot_number ILIKE $${paramIndex++}`);
      queryParams.push(`%${lot_number}%`);
    }

    // Price filter (text LIKE match)
    if (price) {
      whereConditions.push(`CAST(TRUNC(COALESCE(l.price, 0)) AS TEXT) LIKE $${paramIndex++}`);
      queryParams.push(`%${price}%`);
    }

    // Size filter (text LIKE match on total_size_m2)
    if (size) {
      whereConditions.push(`CAST(TRUNC(COALESCE(l.total_size_m2, 0)) AS TEXT) LIKE $${paramIndex++}`);
      queryParams.push(`%${size}%`);
    }

    // Estate name filter
    if (estate_name) {
      whereConditions.push(`e.name ILIKE $${paramIndex++}`);
      queryParams.push(`%${estate_name}%`);
    }

    // Stage name filter
    if (stage_name) {
      whereConditions.push(`es.name ILIKE $${paramIndex++}`);
      queryParams.push(`%${stage_name}%`);
    }

    // Address filter (street or city)
    // Address filter (street, city, or combined "street, city")
    if (address) {
      whereConditions.push(`(
        l.street ILIKE $${paramIndex}
        OR l.city ILIKE $${paramIndex}
        OR (l.street || ', ' || l.city) ILIKE $${paramIndex}
        OR (l.street || ' ' || l.city) ILIKE $${paramIndex}
        OR (l.street || ',' || l.city) ILIKE $${paramIndex}
      )`);
      queryParams.push(`%${address}%`);
      paramIndex++;
    }

    // Status filter (exact match)
    if (status) {
      whereConditions.push(`l.title_status = $${paramIndex++}`);
      queryParams.push(status);
    }

    // Created date filter (enum: past_7_days, past_14_days, past_30_days)
    if (created_date) {
      const dateIntervals = {
        past_7_days: "7 days",
        past_14_days: "14 days",
        past_30_days: "30 days",
      };
      const interval = dateIntervals[created_date];
      if (interval) {
        whereConditions.push(`l.created_at >= NOW() - INTERVAL '${interval}'`);
      }
    }

    // Created by filter
    if (created_by) {
      whereConditions.push(`l.created_by = $${paramIndex++}`);
      queryParams.push(created_by);
    }

    const whereClause =
      whereConditions.length > 0
        ? `WHERE ${whereConditions.join(" AND ")}`
        : "";

    const countSql = `
      SELECT COUNT(*) as total 
      FROM lot l
      LEFT JOIN estate e ON e.estate_id = l.estate_id
      LEFT JOIN estate_stages es ON es.estate_stage_id = l.estate_stage_id
      LEFT JOIN users u ON u.users_id = l.created_by
      ${whereClause}
    `;
    const countResult = await client.query(countSql, queryParams);
    const total = parseInt(countResult.rows[0].total);

    const dataSql = `
      SELECT 
        l.*,
        jsonb_build_object('id', e.estate_id, 'name', e.name) AS estate,
        jsonb_build_object('id', es.estate_stage_id, 'name', es.name) AS estate_stage,
        u.name AS created_by_name
      FROM lot l
      LEFT JOIN estate e ON e.estate_id = l.estate_id
      LEFT JOIN estate_stages es ON es.estate_stage_id = l.estate_stage_id
      LEFT JOIN users u ON u.users_id = l.created_by
      ${whereClause}
      ORDER BY created_at DESC
    `;

    const dataResult = await client.query(dataSql, queryParams);

    return successResponse(
      res,
      dataResult.rows.map(row => {
        const formatted = keysToCamelCase(row);
        delete formatted.estateId;
        delete formatted.estateStageId;
        return formatted;
      }),
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

    const sql = `
      SELECT 
        l.*,
        (SELECT jsonb_build_object('id', e.estate_id, 'name', e.name) FROM estate e WHERE e.estate_id = l.estate_id) AS estate,
        (SELECT jsonb_build_object('id', es.estate_stage_id, 'name', es.name) FROM estate_stages es WHERE es.estate_stage_id = l.estate_stage_id) AS estate_stage,
        (SELECT u.name FROM users u WHERE u.users_id = l.created_by) AS created_by_name
      FROM lot l
      WHERE l.lot_id = $1 AND (
        (l.company_id = $2 AND $2 IS NOT NULL)
        OR (l.builder_id = $3 AND $3 IS NOT NULL)
      )
    `;
    const result = await client.query(sql, [lot_id, companyId, builderId]);

    if (result.rows.length === 0) {
      return successResponse(res, "Lot retrieved successfully.");
    }

    const formatted = keysToCamelCase(result.rows[0]);
    delete formatted.estateId;
    delete formatted.estateStageId;

    return successResponse(
      res,
      formatted,
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

    if (req.body.state_id) {
      const stateCheck = await client.query(
        "SELECT state_id FROM state WHERE state_id = $1 LIMIT 1",
        [req.body.state_id],
      );

      if (stateCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Invalid state_id.");
      }
    }

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
      "lot_type",
      "corner_block",
      "width_m",
      "depth_m",
      "price",
      "site_fall_mm",
      "land_fill_mm",
      "total_size_m2",
      "estate_id",
      "estate_stage_id",
    ];

    const restrictedFields = [
      "leads_id"
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

    if (req.body.estate_id) {
      if (!req.body.estate_stage_id) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "estate_stage_id is required when updating estate_id.",
        );
      }

      const estateCheck = await client.query(
        `SELECT estate_id FROM estate 
         WHERE estate_id = $1 AND (
           (company_id = $2 AND $2 IS NOT NULL)
           OR (builder_id = $3 AND $3 IS NOT NULL)
         ) AND status = true LIMIT 1`,
        [req.body.estate_id, companyId, builderId],
      );

      if (estateCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "Invalid estate_id or estate not found for this builder.",
        );
      }
    }

    if (req.body.estate_stage_id) {
      const estateStageCheck = await client.query(
        `SELECT es.estate_stage_id, es.estate_id 
         FROM estate_stages es
         JOIN estate e ON e.estate_id = es.estate_id
         WHERE es.estate_stage_id = $1 AND (
           (e.company_id = $2 AND $2 IS NOT NULL)
           OR (e.builder_id = $3 AND $3 IS NOT NULL)
         ) AND e.status = true LIMIT 1`,
        [req.body.estate_stage_id, companyId, builderId],
      );

      if (estateStageCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "Invalid estate_stage_id or estate stage not found.",
        );
      }

      const stageEstateId = estateStageCheck.rows[0].estate_id;
      const finalEstateId = req.body.estate_id || checkResult.rows[0].estate_id;

      if (!finalEstateId) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "estate_id is required (either provided or already existing) when estate_stage_id is set.",
        );
      }

      if (stageEstateId !== finalEstateId) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "Estate stage does not belong to the provided/existing estate.",
        );
      }
    }

    if (req.body.lot_number !== undefined) {
      const finalLotNumber = req.body.lot_number;

      const duplicateCheck = await client.query(
        `SELECT lot_id FROM lot 
         WHERE lot_number = $1 AND (
           (company_id = $2 AND $2 IS NOT NULL)
           OR (builder_id = $3 AND $3 IS NOT NULL)
         ) AND lot_id != $4 LIMIT 1`,
        [finalLotNumber, companyId, builderId, lot_id],
      );

      if (duplicateCheck.rowCount > 0) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          `Lot number ${finalLotNumber} already exists in this organization.`,
        );
      }
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
      RETURNING 
        lot.*,
        (SELECT jsonb_build_object('id', e.estate_id, 'name', e.name) FROM estate e WHERE e.estate_id = lot.estate_id) AS estate,
        (SELECT jsonb_build_object('id', es.estate_stage_id, 'name', es.name) FROM estate_stages es WHERE es.estate_stage_id = lot.estate_stage_id) AS estate_stage,
        (SELECT u.name FROM users u WHERE u.users_id = lot.created_by) AS created_by_name
    `;

    const result = await client.query(sql, updateValues);
    await client.query("COMMIT");

    const formatted = keysToCamelCase(result.rows[0]);
    delete formatted.estateId;
    delete formatted.estateStageId;

    return successResponse(
      res,
      formatted,
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
