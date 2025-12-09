const getPool = require("../config/database");
const { errorResponse, successResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");
const { deleteFromS3 } = require("../utils/s3Upload");

exports.createMasterFacade = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const createdBy = req.user?.user_id;
    const imageUrl = req.file?.location || null;

    const { name, range_type, dwelling_type, standard, upgrade, cost } =
      req.body || {};

    if (!builderId || !companyId) {
      return errorResponse(
        res,
        400,
        "Missing builder_id or company_id in user context."
      );
    }

    const builderQuery = `SELECT builder_id FROM builder WHERE builder_id = $1;`;
    const builderResult = await client.query(builderQuery, [builderId]);
    if (builderResult.rowCount === 0) {
      return errorResponse(
        res,
        404,
        "Builder not found or not linked to this company."
      );
    }

    const rangeTypeQuery = `
      SELECT range_id 
      FROM range 
      WHERE range_id = $1 
        AND (builder_id = $2)
    `;
    const rangeTypeResult = await client.query(rangeTypeQuery, [
      range_type,
      builderId,
    ]);
    if (rangeTypeResult.rowCount === 0) {
      return errorResponse(res, 404, "Invalid range type provided.");
    }

    const rangeTypeActiveQuery = `
      SELECT range_id 
      FROM range 
      WHERE range_id = $1 
        AND (builder_id = $2) AND is_active = true
    `;
    const rangeTypeActiveResult = await client.query(rangeTypeActiveQuery, [
      range_type,
      builderId,
    ]);
    if (rangeTypeActiveResult.rowCount === 0) {
      return errorResponse(res, 404, "Inactive range type provided.");
    }

    const dwellingTypeQuery = `
      SELECT dwelling_type_id 
      FROM dwelling_type 
      WHERE dwelling_type_id = $1 
        AND (builder_id = $2)
    `;
    const dwellingTypeResult = await client.query(dwellingTypeQuery, [
      dwelling_type,
      builderId,
    ]);
    if (dwellingTypeResult.rowCount === 0) {
      return errorResponse(res, 404, "Invalid dwelling type provided.");
    }

    const dwellingTypeActiveQuery = `
      SELECT dwelling_type_id 
      FROM dwelling_type 
      WHERE dwelling_type_id = $1 
        AND (builder_id = $2) AND is_active = true
    `;
    const dwellingTypeActiveResult = await client.query(
      dwellingTypeActiveQuery,
      [dwelling_type, builderId]
    );
    if (dwellingTypeActiveResult.rowCount === 0) {
      return errorResponse(res, 404, "Inactive dwelling type provided.");
    }

    const insertFacadeQuery = `
      INSERT INTO master_facade (
        company_id,
        builder_id,
        name,
        image,
        range_type_id,
        dwelling_type_id,
        standard,
        upgrade,
        cost,
        created_by,
        updated_by
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10)
      RETURNING *;
    `;

    const values = [
      companyId,
      builderId,
      name,
      imageUrl,
      rangeTypeResult.rows[0].range_id,
      dwellingTypeResult.rows[0].dwelling_type_id,
      standard || false,
      upgrade || false,
      cost || 0,
      createdBy,
    ];

    const facadeResult = await client.query(insertFacadeQuery, values);

    const createdFacade = {
      ...facadeResult.rows[0],
      range_type_name: range_type,
      dwelling_type_name: dwelling_type,
    };

    return successResponse(
      res,
      keysToCamelCase(createdFacade),
      "Master Facade created successfully."
    );
  } catch (error) {
    console.error("Create Master Facade Error:", error);

    if (error.code === "23505") {
      // Unique violation
      return errorResponse(
        res,
        409,
        "Master Facade with this name already exists."
      );
    }

    return errorResponse(
      res,
      500,
      error.message || "Failed to create Master Facade."
    );
  } finally {
    client.release();
  }
};

exports.getMasterFacades = async (req, res) => {
  const builderId = req.user.builder_id;
  const companyId = req.user.company_id;
  const {
    dwelling_type,
    range_type,
    standard,
    upgrade,
    page = 1,
    limit = 25,
  } = req.query;

  const pool = getPool();
  const client = await pool.connect();

  try {
    let dwellingTypeId = null;
    let rangeTypeId = null;

    if (dwelling_type) {
      const dtResult = await client.query(
        `
        SELECT dwelling_type_id 
        FROM dwelling_type 
        WHERE dwelling_type_id = $1 
          AND (builder_id = $2)
        `,
        [dwelling_type, builderId]
      );

      if (dtResult.rows.length === 0) {
        return errorResponse(res, 400, "Invalid dwelling type.");
      }
      dwellingTypeId = dtResult.rows[0].dwelling_type_id;
    }

    if (range_type) {
      const rtResult = await client.query(
        `
        SELECT range_id 
        FROM range 
        WHERE range_id = $1 
          AND (builder_id = $2)
        `,
        [range_type, builderId]
      );

      if (rtResult.rows.length === 0) {
        return errorResponse(res, 400, "Invalid range type.");
      }
      rangeTypeId = rtResult.rows[0].range_id;
    }

    const limitValue = parseInt(limit, 10);
    const pageValue = parseInt(page, 10);
    const offset = (pageValue - 1) * limitValue;

    let baseQuery = `
      SELECT 
        mf.master_facade_id,
        mf.company_id,
        mf.builder_id,
        mf.name,
        mf.image,
        mf.standard,
        mf.upgrade,
        mf.cost,
        mf.created_at,
        mf.updated_at,
        dt.name AS dwelling_type_name,
        rt.name AS range_type_name
      FROM master_facade mf
      JOIN dwelling_type dt 
        ON mf.dwelling_type_id = dt.dwelling_type_id
      LEFT JOIN range rt 
        ON mf.range_type_id = rt.range_id
      WHERE mf.builder_id = $1 
        AND mf.company_id = $2
        AND mf.is_deleted = false
    `;

    const queryParams = [builderId, companyId];
    let paramIndex = 3;

    if (dwellingTypeId) {
      baseQuery += ` AND mf.dwelling_type_id = $${paramIndex}`;
      queryParams.push(dwellingTypeId);
      paramIndex++;
    }

    if (rangeTypeId) {
      baseQuery += ` AND mf.range_type_id = $${paramIndex}`;
      queryParams.push(rangeTypeId);
      paramIndex++;
    }

    if (standard !== undefined) {
      baseQuery += ` AND mf.standard = $${paramIndex}`;
      queryParams.push(standard === "true");
      paramIndex++;
    }

    if (upgrade !== undefined) {
      baseQuery += ` AND mf.upgrade = $${paramIndex}`;
      queryParams.push(upgrade === "true");
      paramIndex++;
    }

    baseQuery += ` 
      ORDER BY mf.created_at DESC 
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    queryParams.push(limitValue, offset);

    const result = await client.query(baseQuery, queryParams);

    let countQuery = `
      SELECT COUNT(*) AS total
      FROM master_facade mf
      WHERE mf.builder_id = $1 
        AND mf.company_id = $2
        AND mf.is_deleted = false
    `;

    const countParams = [builderId, companyId];
    let countIndex = 3;

    if (dwellingTypeId) {
      countQuery += ` AND mf.dwelling_type_id = $${countIndex}`;
      countParams.push(dwellingTypeId);
      countIndex++;
    }

    if (rangeTypeId) {
      countQuery += ` AND mf.range_type_id = $${countIndex}`;
      countParams.push(rangeTypeId);
      countIndex++;
    }

    if (standard !== undefined) {
      countQuery += ` AND mf.standard = $${countIndex}`;
      countParams.push(standard === "true");
      countIndex++;
    }

    if (upgrade !== undefined) {
      countQuery += ` AND mf.upgrade = $${countIndex}`;
      countParams.push(upgrade === "true");
      countIndex++;
    }

    const countResult = await client.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].total, 10);

    return successResponse(
      res,
      {
        facades: keysToCamelCase(result.rows),
        pagination: {
          currentPage: pageValue,
          totalPages: Math.ceil(total / limitValue),
          totalRecords: total,
          limit: limitValue,
        },
      },
      "Master Facades fetched successfully."
    );
  } catch (error) {
    console.error("Get Master Facades error:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.getMasterFacadeById = async (req, res) => {
  const { id } = req.params;
  const builderId = req.user.builder_id;

  const pool = getPool();
  const client = await pool.connect();

  try {
    const query = `
      SELECT * FROM master_facade 
      WHERE master_facade_id = $1 AND builder_id = $2 AND is_deleted = false;
    `;
    const result = await client.query(query, [id, builderId]);

    if (result.rowCount === 0) {
      return errorResponse(res, 404, "Master Facade not found.");
    }

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Master Facade fetched successfully."
    );
  } catch (error) {
    console.error("Get master facade by ID error:", error);
    return errorResponse(res, 500, "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.updateMasterFacade = async (req, res) => {
  const { facade_id } = req.params;
  const builderId = req.user.builder_id;
  const companyId = req.user.company_id;
  const updates = req.body;
  const imageUrl = req.file?.location;

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const checkFacadeQuery = `
      SELECT * 
      FROM master_facade mf
      LEFT JOIN dwelling_type dt ON mf.dwelling_type_id = dt.dwelling_type_id
      LEFT JOIN range r ON mf.range_type_id = r.range_id
      WHERE mf.master_facade_id = $1 
        AND mf.builder_id = $2 
        AND mf.company_id = $3
        AND mf.is_deleted = false;
    `;
    const checkFacadeResult = await client.query(checkFacadeQuery, [
      facade_id,
      builderId,
      companyId,
    ]);

    if (checkFacadeResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Master Facade not found.");
    }

    const setClauses = [];
    const values = [];

    for (const [key, rawValue] of Object.entries(updates)) {
      if (["image", "dwelling_type", "range_type"].includes(key)) continue;

      let value = rawValue;
      if (typeof value === "string") {
        const lv = value.trim().toLowerCase();
        if (lv === "true" || lv === "false") value = lv === "true";
      }

      setClauses.push(`${key} = $${values.length + 1}`);
      values.push(value);
    }

    if (updates.dwelling_type) {
      const dwellingTypeQuery = `
        SELECT dwelling_type_id 
        FROM dwelling_type 
        WHERE dwelling_type_id = $1 
          AND (builder_id = $2)
      `;
      const dwellingTypeResult = await client.query(dwellingTypeQuery, [
        updates.dwelling_type,
        builderId,
      ]);

      if (dwellingTypeResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 404, "Invalid dwelling type.");
      }

      if (updates.dwelling_type) {
        const dwellingTypeQuery = `
        SELECT dwelling_type_id 
        FROM dwelling_type 
        WHERE dwelling_type_id = $1 
          AND (builder_id = $2) AND is_active = true
      `;
        const dwellingTypeResult = await client.query(dwellingTypeQuery, [
          updates.dwelling_type,
          builderId,
        ]);

        if (dwellingTypeResult.rows.length === 0) {
          await client.query("ROLLBACK");
          return errorResponse(res, 404, "Inactive dwelling type.");
        }
      }

      setClauses.push(`dwelling_type_id = $${values.length + 1}`);
      values.push(dwellingTypeResult.rows[0].dwelling_type_id);
    }

    if (updates.range_type) {
      const rangeTypeQuery = `
        SELECT range_id
        FROM range 
        WHERE range_id = $1 
          AND (builder_id = $2)
      `;
      const rangeTypeResult = await client.query(rangeTypeQuery, [
        updates.range_type,
        builderId,
      ]);

      if (rangeTypeResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 404, "Invalid range type.");
      }

      if (updates.range_type) {
        const rangeTypeQuery = `
        SELECT range_id
        FROM range 
        WHERE range_id = $1 
          AND (builder_id = $2) AND is_active = true
      `;
        const rangeTypeResult = await client.query(rangeTypeQuery, [
          updates.range_type,
          builderId,
        ]);

        if (rangeTypeResult.rows.length === 0) {
          await client.query("ROLLBACK");
          return errorResponse(res, 404, "Inactive range type.");
        }
      }

      setClauses.push(`range_type_id = $${values.length + 1}`);
      values.push(rangeTypeResult.rows[0].range_id);
    }

    if (setClauses.length === 0 && !imageUrl) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "No updatable fields provided.");
    }

    const facadeIndex = values.length + 1;
    const builderIndex = values.length + 2;
    const companyIndex = values.length + 3;

    const updateQuery = `
      UPDATE master_facade 
      SET ${setClauses.join(", ")}, updated_at = NOW()
      WHERE master_facade_id = $${facadeIndex} 
        AND builder_id = $${builderIndex}
        AND company_id = $${companyIndex}
        AND is_deleted = false
      RETURNING *;
    `;
    values.push(facade_id, builderId, companyId);

    const updateResult = await client.query(updateQuery, values);

    if (updateResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Master Facade not found.");
    }

    let updatedImage = updateResult.rows[0].image;
    if (imageUrl !== undefined) {
      if (checkFacadeResult.rows[0].image)
        await deleteFromS3(checkFacadeResult.rows[0].image);

      const updateImageQuery = `
        UPDATE master_facade 
        SET image = $1, updated_at = NOW()
        WHERE master_facade_id = $2 
          AND builder_id = $3 
          AND company_id = $4
          AND is_deleted = false;
      `;
      await client.query(updateImageQuery, [
        imageUrl,
        facade_id,
        builderId,
        companyId,
      ]);
      updatedImage = imageUrl;
    }

    const updatedDwellingType = await client.query(
      `SELECT name FROM dwelling_type WHERE dwelling_type_id = $1;`,
      [updateResult.rows[0].dwelling_type_id]
    );

    const updatedRangeType = await client.query(
      `SELECT name FROM range WHERE range_id = $1;`,
      [updateResult.rows[0].range_type_id]
    );

    await client.query("COMMIT");

    const finalUpdatedData = {
      ...updateResult.rows[0],
      dwelling_type_name: updatedDwellingType.rows[0]?.name || null,
      range_type_name: updatedRangeType.rows[0]?.name || null,
      image: updatedImage,
    };

    return successResponse(
      res,
      keysToCamelCase(finalUpdatedData),
      "Master Facade updated successfully."
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error updating master facade:", error);

    if (error.code === "23505") {
      return errorResponse(
        res,
        409,
        "Master Facade with this name already exists."
      );
    }

    return errorResponse(res, 500, "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.deleteMasterFacade = async (req, res) => {
  const { facade_id } = req.params;
  const builderId = req.user.builder_id;

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const checkFacadeQuery = `
      SELECT * FROM master_facade WHERE master_facade_id = $1 AND builder_id = $2 AND is_deleted = false;
    `;
    const checkFacadeResult = await client.query(checkFacadeQuery, [
      facade_id,
      builderId,
    ]);

    if (checkFacadeResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Master Facade not found.");
    }

    const deleteQuery = `
      UPDATE master_facade 
      SET is_deleted = true, updated_at = NOW()
      WHERE master_facade_id = $1 AND builder_id = $2;
    `;
    const deleteResult = await client.query(deleteQuery, [
      facade_id,
      builderId,
    ]);

    if (deleteResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Master Facade not found.");
    }

    await client.query("COMMIT");

    return successResponse(res, {}, "Master Facade deleted successfully.");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error deleting master facade:", error);
    return errorResponse(res, 500, "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.getMasterFacadeFilters = async (req, res) => {
  const builderId = req.user.builder_id;

  const pool = getPool();
  const client = await pool.connect();

  try {
    const dwellingTypeQuery = `
      SELECT DISTINCT dt.name AS dwelling_type
      FROM master_facade mf
      JOIN dwelling_type dt ON mf.dwelling_type_id = dt.dwelling_type_id
      WHERE mf.builder_id = $1 AND dt.name IS NOT NULL AND mf.is_deleted = false
      ORDER BY dt.name;
    `;

    const standardQuery = `
      SELECT DISTINCT mf.standard
      FROM master_facade mf
      WHERE mf.builder_id = $1 AND mf.is_deleted = false
      ORDER BY mf.standard;
    `;

    const upgradeQuery = `
      SELECT DISTINCT mf.upgrade
      FROM master_facade mf
      WHERE mf.builder_id = $1 AND mf.is_deleted = false
      ORDER BY mf.upgrade;
    `;

    const rangeTypeQuery = `
      SELECT DISTINCT r.name AS range_type
      FROM master_facade mf
      JOIN range r ON mf.range_type_id = r.range_id
      WHERE mf.builder_id = $1 AND r.name IS NOT NULL AND mf.is_deleted = false
      ORDER BY r.name;
    `;

    const [dwellingTypeResult, standardResult, upgradeResult, rangeTypeResult] =
      await Promise.all([
        client.query(dwellingTypeQuery, [builderId]),
        client.query(standardQuery, [builderId]),
        client.query(upgradeQuery, [builderId]),
        client.query(rangeTypeQuery, [builderId]),
      ]);

    const filters = {
      dwellingTypes: dwellingTypeResult.rows.map((row) => row.dwelling_type),
      rangeTypes: rangeTypeResult.rows.map((row) => row.range_type),
      standardOptions: standardResult.rows.map((row) => row.standard),
      upgradeOptions: upgradeResult.rows.map((row) => row.upgrade),
    };

    return successResponse(
      res,
      filters,
      "Master Facade filters fetched successfully."
    );
  } catch (error) {
    console.error("Get facade filters error:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
};
