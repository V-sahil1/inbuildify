const getPool = require("../config/database");
const { successResponse, errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");
const { deleteFromS3 } = require("../utils/s3Upload");

exports.createHouseLandPackage = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { title } = req.body;

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

    if (!title) {
      return errorResponse(
        res,
        400,
        "Title is required for creating house land package",
      );
    }

    await client.query("BEGIN");

    const sql = `
      INSERT INTO house_land_package (
        company_id,
        builder_id,
        title,
        created_by,
        updated_by,
        created_at,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      ) RETURNING *
    `;

    const values = [
      companyId,
      builderId,
      title,
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

    // Handle file upload
    const uploadedFiles = req.files?.attachFiles?.map(file => file.location) || [];
    const attachFiles = uploadedFiles.length > 0 ? uploadedFiles : req.body.attach_files;

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
    const existingPackage = checkResult.rows[0];

    const allowedFields = [
      "title",
      "range_id",
      "dwelling_type_id",
      "template_id",
      "contact_id",
      "contact_show_pdf",
      "lot_id",
      "price_type",
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
      // "attach_files" is handled separately in file upload logic
    ];

    const restrictedFields = [
      "company_id",
      "builder_id",
      "created_by",
      "created_at",
    ];

    await client.query("BEGIN");

    // Validate lot ownership if provided
    if (req.body.lot_id) {
      const lotCheck = await client.query(
        `SELECT lot_id FROM lot 
         WHERE lot_id = $1 AND (
           (company_id = $2 AND $2 IS NOT NULL)
           OR (builder_id = $3 AND $3 IS NOT NULL)
         ) LIMIT 1`,
        [req.body.lot_id, companyId, builderId],
      );

      if (lotCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "Invalid lot_id or lot not found.",
        );
      }
    }

    // Validate contact ownership if provided
    if (req.body.contact_id) {
      // For Contact role users, they can assign any user ID (not just their own)
      const contactCheck = await client.query(
        `SELECT users_id FROM users 
         WHERE users_id = $1 LIMIT 1`,
        [req.body.contact_id],
      );

      if (contactCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "Invalid contact_id or contact not found.",
        );
      }
    }

    // Validate dwelling_type_id if provided
    if (req.body.dwelling_type_id) {
      const dwellingTypeCheck = await client.query(
        `SELECT dwelling_type_id FROM dwelling_type WHERE dwelling_type_id = $1 AND (company_id = $2 OR builder_id = $3) AND is_active = true LIMIT 1`,
        [req.body.dwelling_type_id, companyId, builderId],
      );

      if (dwellingTypeCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "Invalid dwelling_type_id or dwelling type not found/inactive",
        );
      }
    }

    // Validate range_id if provided
    if (req.body.range_id) {
      const rangeCheck = await client.query(
        `SELECT range_id FROM range WHERE range_id = $1 AND (company_id = $2 OR builder_id = $3) AND is_active = true LIMIT 1`,
        [req.body.range_id, companyId, builderId],
      );

      if (rangeCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "Invalid range_id or range not found/inactive",
        );
      }
    }

    // Validate floor_plan_id if provided
    if (req.body.floor_plan_id) {
      const floorPlanCheck = await client.query(
        `SELECT floor_plan_id FROM floor_plan WHERE floor_plan_id = $1 AND (company_id = $2 OR builder_id = $3) AND status = true LIMIT 1`,
        [req.body.floor_plan_id, companyId, builderId],
      );

      if (floorPlanCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "Invalid floor_plan_id or floor plan not found",
        );
      }
    }

    // Validate facade_id if provided
    if (req.body.facade_id) {
      const facadeCheck = await client.query(
        `SELECT facade_id FROM facade WHERE facade_id = $1 AND (company_id = $2 OR builder_id = $3) AND status = true LIMIT 1`,
        [req.body.facade_id, companyId, builderId],
      );

      if (facadeCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "Invalid facade_id or facade not found",
        );
      }
    }

    // Validate house_feature_id if provided
    if (req.body.house_feature_id) {
      const houseFeatureCheck = await client.query(
        `SELECT house_feature_id FROM house_feature WHERE house_feature_id = $1 AND (company_id = $2 OR builder_id = $3) LIMIT 1`,
        [req.body.house_feature_id, companyId, builderId],
      );

      if (houseFeatureCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "Invalid house_feature_id or house feature not found",
        );
      }
    }

    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;

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

    // Handle file upload and deletion
    let updatedFiles = existingPackage.attach_files || [];
    if (attachFiles !== undefined) {
      if (!attachFiles || attachFiles.length === 0) {
        // Remove files if null or empty array is provided
        if (existingPackage.attach_files && existingPackage.attach_files.length > 0) {
          for (const fileUrl of existingPackage.attach_files) {
            if (fileUrl && fileUrl.trim() && fileUrl.startsWith('http')) {
              try {
                await deleteFromS3(fileUrl);
              } catch (error) {
                console.error(`Error deleting file from S3: ${fileUrl}`, error.message);
              }
            }
          }
        }
        updateFields.push(`attach_files = $${paramIndex++}`);
        updateValues.push([]);
        updatedFiles = [];
      } else {
        // Update with new files and delete old ones
        if (existingPackage.attach_files && existingPackage.attach_files.length > 0) {
          for (const fileUrl of existingPackage.attach_files) {
            if (fileUrl && fileUrl.trim() && fileUrl.startsWith('http') && !attachFiles.includes(fileUrl)) {
              try {
                await deleteFromS3(fileUrl);
              } catch (error) {
                console.error(`Error deleting file from S3: ${fileUrl}`, error.message);
              }
            }
          }
        }
        updateFields.push(`attach_files = $${paramIndex++}`);
        updateValues.push(attachFiles);
        updatedFiles = attachFiles;
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

    const finalData = {
      ...result.rows[0],
      attach_files: updatedFiles,
    };

    return successResponse(
      res,
      keysToCamelCase(finalData),
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

    // Delete associated files from S3
    const existingPackage = checkResult.rows[0];
    if (existingPackage.attach_files && existingPackage.attach_files.length > 0) {
      for (const fileUrl of existingPackage.attach_files) {
        if (fileUrl) {
          await deleteFromS3(fileUrl);
        }
      }
    }

    const sql = "DELETE FROM house_land_package WHERE house_land_package_id = $1 AND ((company_id = $2 AND $2 IS NOT NULL) OR (builder_id = $3 AND $3 IS NOT NULL)) RETURNING *";
    const result = await client.query(sql, [house_land_package_id, companyId, builderId]);
    await client.query("COMMIT");

    return successResponse(
      res,
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