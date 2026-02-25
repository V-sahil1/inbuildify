const getPool = require("../config/database");
const { successResponse, errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");
const { deleteFromS3 } = require("../utils/s3Upload");

const formatHouseLandPackageData = (row) => {
  const priceSum = parseFloat(row.price_sum || 0);
  const commissionSum = parseFloat(row.commission_sum || 0);
  const data = keysToCamelCase(row);
  delete data.priceSum;
  delete data.commissionSum;

  const ordered = {};
  for (const key of Object.keys(data)) {
    if (['floorPlanName', 'facadeName', 'createdByName'].includes(key)) continue;
    ordered[key] = data[key];
    if (key === 'floorPlanId' && data.floorPlanName !== undefined) {
      ordered['floorPlanName'] = data.floorPlanName;
    }
    if (key === 'facadeId' && data.facadeName !== undefined) {
      ordered['facadeName'] = data.facadeName;
    }
    if (key === 'createdBy' && data.createdByName !== undefined) {
      ordered['createdByName'] = data.createdByName;
    }
  }

  let landPrice = 0;
  if (row.lot_details && row.lot_details.price) {
    landPrice = parseFloat(row.lot_details.price);
  }

  const houseTotal = priceSum + commissionSum;

  return {
    ...ordered,
    landPrice,
    houseTotal,
    commissionTotal: commissionSum,
    totalPrice: houseTotal + landPrice
  };
};

exports.createHouseLandPackage = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const {
      title,
      lot_id,
      dwelling_type_id,
      package_group_id,
      range_id,
      disclaimer_type,
      floor_plan_id,
      facade_id
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

    if (!title) {
      return errorResponse(
        res,
        400,
        "Title is required for creating house land package",
      );
    }

    const titleCheck = await client.query(
      `SELECT house_land_package_id FROM house_land_package 
       WHERE title = $1 AND (
         (company_id = $2 AND $2 IS NOT NULL)
         OR (builder_id = $3 AND $3 IS NOT NULL)
       ) LIMIT 1`,
      [title, companyId, builderId],
    );

    if (titleCheck.rowCount > 0) {
      return errorResponse(
        res,
        400,
        "A house land package with this title already exists",
      );
    }

    if (lot_id && !dwelling_type_id) {
      return errorResponse(
        res,
        400,
        "Dwelling type ID is required when a Lot ID is provided",
      );
    }

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
      return errorResponse(res, 404, "Lot not found or unauthorized access.");
    }
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

    if (package_group_id) {
      const lpgCheck = await client.query(
        `SELECT lot_package_group_id FROM lot_package_group 
         WHERE lot_package_group_id = $1 AND (
           (company_id = $2 AND $2 IS NOT NULL)
           OR (builder_id = $3 AND $3 IS NOT NULL)
         ) LIMIT 1`,
        [package_group_id, companyId, builderId],
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

    await client.query("BEGIN");

    const sql = `
      WITH new_pkg AS (
        INSERT INTO house_land_package (
          company_id,
          builder_id,
          title,
          lot_id,
          dwelling_type_id,
          package_group_id,
          range_id,
          disclaimer_type,
          floor_plan_id,
          facade_id,
          created_by,
          updated_by,
          created_at,
          updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        ) RETURNING *
      )
      SELECT np.*,
      (SELECT name FROM floor_plan WHERE floor_plan_id = np.floor_plan_id LIMIT 1) AS floor_plan_name,
      (SELECT name FROM facade WHERE facade_id = np.facade_id LIMIT 1) AS facade_name,
      (SELECT name FROM users WHERE users_id = np.created_by LIMIT 1) AS created_by_name,
      (
         SELECT json_build_object(
           'lot_id', l.lot_id,
           'estate_id', l.estate_id,
           'estate_name', (SELECT name FROM estate WHERE estate_id = l.estate_id LIMIT 1),
           'estate_stage_id', l.estate_stage_id,
           'estate_stage_name', (SELECT name FROM estate_stages WHERE estate_stage_id = l.estate_stage_id LIMIT 1),
           'lot_number', l.lot_number,
           'street', l.street,
           'city', l.city,
           'zip_code', l.zip_code,
           'title_status', l.title_status,
           'title_date', l.title_date,
           'lot_type', l.lot_type,
           'corner_block', l.corner_block,
           'width_m', l.width_m,
           'depth_m', l.depth_m,
           'size_m2', l.size_m2,
           'price', l.price,
           'site_fall_mm', l.site_fall_mm,
           'land_fill_mm', l.land_fill_mm,
           'total_size_m2', l.total_size_m2
         )
         FROM lot l WHERE l.lot_id = np.lot_id LIMIT 1
      ) AS lot_details
      FROM new_pkg np
    `;

    const values = [
      companyId,
      builderId,
      title,
      lot_id || null,
      dwelling_type_id || null,
      package_group_id || null,
      range_id || null,
      disclaimer_type || null,
      floor_plan_id || null,
      facade_id || null,
      userId,
      userId,
    ];

    const result = await client.query(sql, values);
    const houseLandPackageId = result.rows[0].house_land_package_id;

    const commissionsResult = await client.query(
      `SELECT jc.job_commission_id, COALESCE(SUM(jcss.commission_value), 0) as total_commission
       FROM job_commission jc
       LEFT JOIN job_commission_sub_stage jcss ON jc.job_commission_id = jcss.job_commission_id
       WHERE (jc.company_id = $1 AND $1 IS NOT NULL) OR (jc.builder_id = $2 AND $2 IS NOT NULL)
       GROUP BY jc.job_commission_id`,
      [companyId, builderId],
    );

    let initialCommissionTotal = 0;
    for (const comm of commissionsResult.rows) {
      const commValue = parseFloat(comm.total_commission || 0);
      await client.query(
        `INSERT INTO h_l_package_commission_map (house_land_package_id, job_commission_id, total_commission)
         VALUES ($1, $2, $3)`,
        [houseLandPackageId, comm.job_commission_id, commValue],
      );
      initialCommissionTotal += commValue;
    }

    await client.query("COMMIT");

    const finalData = {
      ...result.rows[0],
      price_sum: 0,
      commission_sum: initialCommissionTotal
    };

    const formattedData = formatHouseLandPackageData(finalData);

    return successResponse(
      res,
      formattedData,
      "House land package created successfully and default commissions mapped",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Create house land package error:", error);
    return errorResponse(res, 500, "Internal server error");
  } finally {
    client.release();
  }
};

exports.getHouseLandPackageDetailedInfo = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { house_land_package_id } = req.params;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId && !companyId) {
      return errorResponse(res, 401, "Unauthorized: User must belong to either a builder or company");
    }

    const sql = `
      SELECT hlp.*, 
       -- Lot Details
       l.lot_number, l.street as lot_street, l.city as lot_city, l.zip_code as lot_zip, 
       l.lot_type as lot_type, l.width_m as lot_width, l.depth_m as lot_depth, 
       l.size_m2 as lot_size, l.total_size_m2 as lot_total_size, l.price as land_price,
       -- Estate & Stage
       e.name as estate_name, es.name as stage_name,
       -- Contact
       u.name as name,
       u.email as contact_email, u.phone as contact_phone,
       -- Design
       r.name as range_name, dt.name as dwelling_type_name, 
       te.name as template_name, f.name as facade_name, f.image as facade_image,
       fp.name, hf.name as house_feature_name,
       -- Totals
       COALESCE((SELECT SUM(total_price) FROM h_l_package_pricelist_item_map WHERE house_land_package_id = hlp.house_land_package_id), 0) as price_sum,
       COALESCE((SELECT SUM(total_commission) FROM h_l_package_commission_map WHERE house_land_package_id = hlp.house_land_package_id), 0) as commission_sum
       FROM house_land_package hlp
       LEFT JOIN lot l ON hlp.lot_id = l.lot_id
       LEFT JOIN estate e ON l.estate_id = e.estate_id
       LEFT JOIN estate_stages es ON l.estate_stage_id = es.estate_stage_id
       LEFT JOIN users u ON hlp.contact_id = u.users_id
       LEFT JOIN range r ON hlp.range_id = r.range_id
       LEFT JOIN dwelling_type dt ON hlp.dwelling_type_id = dt.dwelling_type_id
       LEFT JOIN template_email te ON hlp.template_id = te.template_email_id
       LEFT JOIN facade f ON hlp.facade_id = f.facade_id
       LEFT JOIN floor_plan fp ON hlp.floor_plan_id = fp.floor_plan_id
       LEFT JOIN house_feature hf ON hlp.house_feature_id = hf.house_feature_id
      WHERE hlp.house_land_package_id = $1 AND (
        (hlp.company_id = $2 AND $2 IS NOT NULL)
        OR (hlp.builder_id = $3 AND $3 IS NOT NULL)
      )`;
    const result = await client.query(sql, [house_land_package_id, companyId, builderId]);

    if (result.rows.length === 0) {
      return errorResponse(res, 404, "House land package not found");
    }

    const row = result.rows[0];
    const housePrice = parseFloat(row.price_sum);
    const commission = parseFloat(row.commission_sum);
    const landPrice = parseFloat(row.land_price || 0);
    const houseTotal = housePrice + commission;
    const totalPrice = houseTotal + landPrice;

    // Fetch inclusions for this package
    const inclusionsResult = await client.query(
      `SELECT map.id as map_id, pli.price_list_item_id, pli.item_description, 
       map.quantity, map.total_price
       FROM h_l_package_pricelist_item_map map
       JOIN price_list_item pli ON map.price_list_item_id = pli.price_list_item_id
       WHERE map.house_land_package_id = $1`,
      [house_land_package_id],
    );

    const packageData = {
      houseLandPackageId: row.house_land_package_id,
      title: row.title,
      lotDetails: {
        lotId: row.lot_id,
        lotNumber: row.lot_number,
        street: row.lot_street,
        city: row.lot_city,
        zipCode: row.lot_zip,
        estateName: row.estate_name,
        stageName: row.stage_name,
        lotType: row.lot_type,
        width: parseFloat(row.lot_width || 0),
        depth: parseFloat(row.lot_depth || 0),
        size: parseFloat(row.lot_size || 0),
        totalArea: parseFloat(row.lot_total_size || 0),
      },
      contactDetails: {
        contactId: row.contact_id,
        firstName: row.contact_first_name,
        lastName: row.contact_last_name,
        email: row.contact_email,
        phone: row.contact_phone,
        showInPdf: row.contact_show_pdf,
      },
      priceDetails: {
        priceType: row.price_type,
        housePrice: houseTotal,
        landPrice: landPrice,
        commission: commission,
        totalPrice: totalPrice,
      },
      designDetails: {
        rangeId: row.range_id,
        rangeName: row.range_name,
        dwellingTypeId: row.dwelling_type_id,
        dwellingTypeName: row.dwelling_type_name,
        templateId: row.template_id,
        templateName: row.template_name,
        facadeId: row.facade_id,
        facadeName: row.facade_name,
        facadeImage: row.facade_image,
        floorPlanId: row.floor_plan_id,
        floorPlanName: row.floor_plan_name,
        floorPlanDescription: row.floor_plan_description,
      },
      packageGroupDetails: {
        packageGroupId: row.package_group_id,
      },
      inclusionDetails: inclusionsResult.rows.map(inc => keysToCamelCase(inc)),
      houseFeatures: {
        houseFeatureId: row.house_feature_id,
        name: row.house_feature_name,
      },
      packageDescription: row.package_description,
      disclaimer: {
        type: row.disclaimer_type,
        description: row.disclaimer_description,
      },
      attachFiles: row.attach_files || [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };

    return successResponse(
      res,
      packageData,
      "House land package detailed info retrieved successfully",
    );
  } catch (error) {
    console.error("Get house land package detailed info error:", error);
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
      `SELECT hlp.*, 
       COALESCE((SELECT SUM(total_price) FROM h_l_package_pricelist_item_map WHERE house_land_package_id = hlp.house_land_package_id), 0) as price_sum,
       COALESCE((SELECT SUM(total_commission) FROM h_l_package_commission_map WHERE house_land_package_id = hlp.house_land_package_id), 0) as commission_sum,
       (SELECT name FROM floor_plan WHERE floor_plan_id = hlp.floor_plan_id LIMIT 1) AS floor_plan_name,
       (SELECT name FROM facade WHERE facade_id = hlp.facade_id LIMIT 1) AS facade_name,
       (SELECT name FROM users WHERE users_id = hlp.created_by LIMIT 1) AS created_by_name,
       (
          SELECT json_build_object(
            'lot_id', l.lot_id,
            'estate_id', l.estate_id,
            'estate_name', (SELECT name FROM estate WHERE estate_id = l.estate_id LIMIT 1),
            'estate_stage_id', l.estate_stage_id,
            'estate_stage_name', (SELECT name FROM estate_stages WHERE estate_stage_id = l.estate_stage_id LIMIT 1),
            'lot_number', l.lot_number,
            'street', l.street,
            'city', l.city,
            'zip_code', l.zip_code,
            'title_status', l.title_status,
            'title_date', l.title_date,
            'lot_type', l.lot_type,
            'corner_block', l.corner_block,
            'width_m', l.width_m,
            'depth_m', l.depth_m,
            'size_m2', l.size_m2,
            'price', l.price,
            'site_fall_mm', l.site_fall_mm,
            'land_fill_mm', l.land_fill_mm,
            'total_size_m2', l.total_size_m2
          )
          FROM lot l WHERE l.lot_id = hlp.lot_id LIMIT 1
       ) AS lot_details
       FROM house_land_package hlp
       ${whereClause}
       ORDER BY hlp.created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...queryParams, limitNum, offset],
    );

    const packages = result.rows.map(row => formatHouseLandPackageData(row));

    return successResponse(res, {
      houseLandPackages: packages,
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

    const sql = `
      SELECT hlp.*,
      COALESCE((SELECT SUM(total_price) FROM h_l_package_pricelist_item_map WHERE house_land_package_id = hlp.house_land_package_id), 0) as price_sum,
      COALESCE((SELECT SUM(total_commission) FROM h_l_package_commission_map WHERE house_land_package_id = hlp.house_land_package_id), 0) as commission_sum,
      (SELECT name FROM floor_plan WHERE floor_plan_id = hlp.floor_plan_id LIMIT 1) AS floor_plan_name,
      (SELECT name FROM facade WHERE facade_id = hlp.facade_id LIMIT 1) AS facade_name,
      (SELECT name FROM users WHERE users_id = hlp.created_by LIMIT 1) AS created_by_name,
      (
         SELECT json_build_object(
           'lot_id', l.lot_id,
           'estate_id', l.estate_id,
           'estate_name', (SELECT name FROM estate WHERE estate_id = l.estate_id LIMIT 1),
           'estate_stage_id', l.estate_stage_id,
           'estate_stage_name', (SELECT name FROM estate_stages WHERE estate_stage_id = l.estate_stage_id LIMIT 1),
           'lot_number', l.lot_number,
           'street', l.street,
           'city', l.city,
           'zip_code', l.zip_code,
           'title_status', l.title_status,
           'title_date', l.title_date,
           'lot_type', l.lot_type,
           'corner_block', l.corner_block,
           'width_m', l.width_m,
           'depth_m', l.depth_m,
           'size_m2', l.size_m2,
           'price', l.price,
           'site_fall_mm', l.site_fall_mm,
           'land_fill_mm', l.land_fill_mm,
           'total_size_m2', l.total_size_m2
         )
         FROM lot l WHERE l.lot_id = hlp.lot_id LIMIT 1
      ) AS lot_details
      FROM house_land_package hlp 
      WHERE hlp.house_land_package_id = $1 AND (
        (hlp.company_id = $2 AND $2 IS NOT NULL)
        OR (hlp.builder_id = $3 AND $3 IS NOT NULL)
      )`;
    const result = await client.query(sql, [house_land_package_id, companyId, builderId]);

    if (result.rows.length === 0) {
      return errorResponse(res, 404, "House land package not found");
    }

    const formattedData = formatHouseLandPackageData(result.rows[0]);

    return successResponse(
      res,
      formattedData,
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
      "floor_plan_id",
      "floor_plan_description",
      "facade_id",
      "package_group_id",
      "package_description",
      "house_feature_id",
      "disclaimer_type",
      "disclaimer_description",
    ];

    const restrictedFields = [
      "company_id",
      "builder_id",
      "created_by",
      "created_at",
    ];

    await client.query("BEGIN");

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

    if (req.body.contact_id) {
      const contactCheck = await client.query(
        `SELECT u.users_id FROM users u
         JOIN role r ON u.role_id = r.role_id
         WHERE u.users_id = $1 AND r.name = 'Contact' AND u.is_deleted = false AND u.is_active = true LIMIT 1`,
        [req.body.contact_id],
      );

      if (contactCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(
          res,
          400,
          "Invalid contact_id or user does not have the 'Contact' role or user is deleted or inactive.",
        );
      }
    }

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

    if (req.body.package_group_id) {
      const groupCheck = await client.query(
        `SELECT lot_package_group_id FROM lot_package_group 
         WHERE lot_package_group_id = $1 AND (
           (company_id = $2 AND $2 IS NOT NULL)
           OR (builder_id = $3 AND $3 IS NOT NULL)
         ) LIMIT 1`,
        [req.body.package_group_id, companyId, builderId],
      );

      if (groupCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Invalid package_group_id or group not found.");
      }

      const finalLotId = req.body.lot_id || existingPackage.lot_id;
      if (finalLotId) {
        const mappingCheck = await client.query(
          `SELECT lot_package_id FROM lot_package 
           WHERE lot_id = $1 AND lot_package_group_id = $2 LIMIT 1`,
          [finalLotId, req.body.package_group_id],
        );

        if (mappingCheck.rowCount === 0) {
          await client.query("ROLLBACK");
          return errorResponse(res, 400, "The selected package group does not contain any packages for this lot.");
        }
      }
    } else if (req.body.lot_id && existingPackage.package_group_id) {
      const mappingCheck = await client.query(
        `SELECT lot_package_id FROM lot_package 
         WHERE lot_id = $1 AND lot_package_group_id = $2 LIMIT 1`,
        [req.body.lot_id, existingPackage.package_group_id],
      );

      if (mappingCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "The existing package group does not contain any packages for the new lot.");
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

    let updatedFiles = existingPackage.attach_files || [];

    // If the user uploaded a new PDF, replace the old one
    if (uploadedFiles && uploadedFiles.length > 0) {
      // Delete any existing PDFs from S3
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
      
      // Store only the new uploaded PDF
      updatedFiles = [uploadedFiles[0]];
      updateFields.push(`attach_files = $${paramIndex++}`);
      updateValues.push(updatedFiles);
    }
    // If no new PDF is uploaded, `updatedFiles` retains the old PDF.

    if (updateFields.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "No valid fields to update");
    }

    updateFields.push(`updated_by = $${paramIndex++}`);
    updateValues.push(userId);

    const sql = `
      WITH updated_pkg AS (
        UPDATE house_land_package 
        SET ${updateFields.join(", ")}, updated_at = CURRENT_TIMESTAMP
        WHERE house_land_package_id = $${paramIndex++}
        RETURNING *
      )
      SELECT up.*, 
      (SELECT name FROM floor_plan WHERE floor_plan_id = up.floor_plan_id LIMIT 1) AS floor_plan_name,
      (SELECT name FROM facade WHERE facade_id = up.facade_id LIMIT 1) AS facade_name,
      (SELECT name FROM users WHERE users_id = up.created_by LIMIT 1) AS created_by_name,
      (
         SELECT json_build_object(
           'lot_id', l.lot_id,
           'estate_id', l.estate_id,
           'estate_name', (SELECT name FROM estate WHERE estate_id = l.estate_id LIMIT 1),
           'estate_stage_id', l.estate_stage_id,
           'estate_stage_name', (SELECT name FROM estate_stages WHERE estate_stage_id = l.estate_stage_id LIMIT 1),
           'lot_number', l.lot_number,
           'street', l.street,
           'city', l.city,
           'zip_code', l.zip_code,
           'title_status', l.title_status,
           'title_date', l.title_date,
           'lot_type', l.lot_type,
           'corner_block', l.corner_block,
           'width_m', l.width_m,
           'depth_m', l.depth_m,
           'size_m2', l.size_m2,
           'price', l.price,
           'site_fall_mm', l.site_fall_mm,
           'land_fill_mm', l.land_fill_mm,
           'total_size_m2', l.total_size_m2
         )
         FROM lot l WHERE l.lot_id = up.lot_id LIMIT 1
      ) AS lot_details
      FROM updated_pkg up
    `;

    updateValues.push(house_land_package_id);

    const result = await client.query(sql, updateValues);

    const totalsQuery = `
      SELECT 
      COALESCE((SELECT SUM(total_price) FROM h_l_package_pricelist_item_map WHERE house_land_package_id = $1), 0) as price_sum,
      COALESCE((SELECT SUM(total_commission) FROM h_l_package_commission_map WHERE house_land_package_id = $1), 0) as commission_sum
    `;
    const totalsResult = await client.query(totalsQuery, [house_land_package_id]);
    const priceSum = parseFloat(totalsResult.rows[0].price_sum);
    const commissionSum = parseFloat(totalsResult.rows[0].commission_sum);

    await client.query("COMMIT");

    const finalData = {
      ...result.rows[0],
      price_sum: priceSum,
      commission_sum: commissionSum,
      attach_files: updatedFiles
    };

    const formattedData = formatHouseLandPackageData(finalData);

    return successResponse(
      res,
      formattedData,
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