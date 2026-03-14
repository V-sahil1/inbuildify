const getPool = require("../../config/database");
const { successResponse, errorResponse } = require("../../helper/response");
const { keysToCamelCase } = require("../../utils/common");
const addressRepo = require("../../repositories/address.repository");

exports.createProperty = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId && !companyId) {
      return errorResponse(res, 401, "Unauthorized: User must belong to either a builder or company");
    }

    const {
      leads_id,
      address,
      lot_no,
      street_no,
      estate_name,
      title_status,
      title_date,
      compaction_report,
      land_type,
      width_m,
      depth_m,
      total_size_m2,
      site_fall_mm,
      land_fill_mm,
      bush_fire,
      corner_block,
    } = req.body;

    const leadCheck = await client.query(
      `SELECT 1 FROM leads WHERE leads_id = $1 AND (
        (company_id = $2 AND $2 IS NOT NULL)
        OR (builder_id = $3 AND $3 IS NOT NULL)
      )`,
      [leads_id, companyId, builderId]
    );

    if (leadCheck.rowCount === 0) {
      return errorResponse(res, 400, "Invalid lead id.");
    }

    const existing = await client.query(
      `SELECT property_id, address_id FROM property WHERE leads_id = $1`,
      [leads_id]
    );

    let addressId = null;
    if (address) {
      const existingAddressId = existing.rowCount > 0 ? existing.rows[0].address_id : null;
      addressId = await addressRepo.createOrUpdateAddress(existingAddressId, address, client);
    }

    let result;
    if (existing.rowCount > 0) {
      return errorResponse(res, 400, "Property already exists for this lead. Only one property is allowed per lead.");
    } else {
      result = await client.query(
        `INSERT INTO property (
          leads_id, address_id, lot_no, street_no, estate_name, title_status,
          title_date, compaction_report, land_type, width_m, depth_m,
          total_size_m2, site_fall_mm, land_fill_mm, bush_fire, corner_block,
          created_at, updated_at
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,
          CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
        )
        RETURNING *`,
        [
          leads_id,
          addressId,
          lot_no,
          street_no,
          estate_name,
          title_status,
          title_date,
          compaction_report,
          land_type || "REGULAR",
          width_m,
          depth_m,
          total_size_m2,
          site_fall_mm,
          land_fill_mm,
          bush_fire,
          corner_block
        ]
      );
    }

    // Fetch the updated property object with its nested address schema
    const selectQuery = await client.query(`
      SELECT 
        p.*,
        (
          SELECT jsonb_build_object(
            'addressId', a.address_id,
            'addressLine1', a.address_line1,
            'addressLine2', a.address_line2,
            'city', a.city,
            'stateId', a.state_id,
            'countryId', a.country_id,
            'zipCode', a.zip_code
          ) FROM address a WHERE a.address_id = p.address_id
        ) AS address
      FROM property p WHERE p.property_id = $1
    `, [result.rows[0].property_id]);

    const formatted = keysToCamelCase(selectQuery.rows[0]);
    delete formatted.addressId;

    return successResponse(
      res,
      formatted,
      "Property created successfully"
    );
  } catch (error) {
    console.error("Error creating property:", error);
    return errorResponse(res, error?.status || 500, error?.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.getPropertyByLeadId = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId && !companyId) {
      return errorResponse(res, 401, "Unauthorized: User must belong to either a builder or company");
    }

    const { leads_id } = req.params;

    const query = `
      SELECT 
        p.*,
        (
          SELECT jsonb_build_object(
            'addressId', a.address_id,
            'addressLine1', a.address_line1,
            'addressLine2', a.address_line2,
            'city', a.city,
            'stateId', a.state_id,
            'countryId', a.country_id,
            'zipCode', a.zip_code
          ) FROM address a WHERE a.address_id = p.address_id
        ) AS address
      FROM property p
      JOIN leads l ON l.leads_id = p.leads_id
      WHERE p.leads_id = $1 AND (
        (l.company_id = $2 AND $2 IS NOT NULL)
        OR (l.builder_id = $3 AND $3 IS NOT NULL)
      )
    `;
    const result = await client.query(query, [leads_id, companyId, builderId]);

    if (result.rowCount === 0) {
      return errorResponse(res, 404, "Property not found for this lead");
    }

    const formatted = keysToCamelCase(result.rows[0]);
    delete formatted.addressId;

    return successResponse(
      res,
      formatted,
      "Property fetched successfully"
    );
  } catch (error) {
    console.error("Error fetching property:", error);
    return errorResponse(res, error?.status || 400, error?.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.updateProperty = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId && !companyId) {
      return errorResponse(res, 401, "Unauthorized: User must belong to either a builder or company");
    }

    const { property_id } = req.params;

    const existing = await client.query(
      `SELECT p.property_id, p.address_id 
       FROM property p 
       JOIN leads l ON l.leads_id = p.leads_id 
       WHERE p.property_id = $1 AND (
        (l.company_id = $2 AND $2 IS NOT NULL)
        OR (l.builder_id = $3 AND $3 IS NOT NULL)
      )`,
      [property_id, companyId, builderId]
    );

    if (existing.rowCount === 0) {
      return errorResponse(res, 404, "Property not found or does not belong to your organization.");
    }

    const {
      address,
      lot_no,
      street_no,
      estate_name,
      title_status,
      title_date,
      compaction_report,
      land_type,
      width_m,
      depth_m,
      total_size_m2,
      site_fall_mm,
      land_fill_mm,
      bush_fire,
      corner_block,
    } = req.body;

    let addressId = existing.rows[0].address_id;
    if (address) {
      addressId = await addressRepo.createOrUpdateAddress(addressId, address, client);
    }

    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;

    const allowedFields = [
      "lot_no",
      "street_no",
      "estate_name",
      "title_status",
      "title_date",
      "compaction_report",
      "land_type",
      "width_m",
      "depth_m",
      "total_size_m2",
      "site_fall_mm",
      "land_fill_mm",
      "bush_fire",
      "corner_block",
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateFields.push(`${field} = $${paramIndex++}`);
        updateValues.push(req.body[field] === null ? null : req.body[field]);
      }
    }

    // Always update address_id if processing via repo
    if (addressId) {
      updateFields.push(`address_id = $${paramIndex++}`);
      updateValues.push(addressId);
    }

    if (updateFields.length === 0) {
      return errorResponse(res, 400, "No valid fields to update");
    }

    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    updateValues.push(property_id);

    const updateSql = `
      UPDATE property 
      SET ${updateFields.join(", ")}
      WHERE property_id = $${paramIndex}
      RETURNING *
    `;

    const result = await client.query(updateSql, updateValues);

    const selectQuery = await client.query(`
      SELECT 
        p.*,
        (
          SELECT jsonb_build_object(
            'addressId', a.address_id,
            'addressLine1', a.address_line1,
            'addressLine2', a.address_line2,
            'city', a.city,
            'stateId', a.state_id,
            'countryId', a.country_id,
            'zipCode', a.zip_code
          ) FROM address a WHERE a.address_id = p.address_id
        ) AS address
      FROM property p WHERE p.property_id = $1
    `, [result.rows[0].property_id]);

    const formatted = keysToCamelCase(selectQuery.rows[0]);
    delete formatted.addressId;

    return successResponse(
      res,
      formatted,
      "Property updated successfully"
    );
  } catch (error) {
    console.error("Error updating property:", error);
    return errorResponse(res, error?.status || 500, error?.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.getAllProperties = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId && !companyId) {
      return errorResponse(res, 401, "Unauthorized: User must belong to either a builder or company");
    }

    const { search } = req.query;

    let whereConditions = [];
    let queryParams = [];
    let paramIndex = 1;

    whereConditions.push(`(
      (l.company_id = $${paramIndex++} AND $${paramIndex - 1} IS NOT NULL)
      OR (l.builder_id = $${paramIndex++} AND $${paramIndex - 1} IS NOT NULL)
    )`);
    queryParams.push(companyId, builderId);

    if (search) {
      whereConditions.push(`(
        p.estate_name ILIKE $${paramIndex++} OR
        p.title_status ILIKE $${paramIndex++} OR
        a.address_line1 ILIKE $${paramIndex++} OR
        a.city ILIKE $${paramIndex++} OR
        a.zip_code ILIKE $${paramIndex++}
      )`);
      const searchTerm = `%${search}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }

    const whereClause =
      whereConditions.length > 0
        ? `WHERE ${whereConditions.join(" AND ")}`
        : "";

    const query = `
      SELECT 
        p.*,
        (
          SELECT jsonb_build_object(
            'addressId', a.address_id,
            'addressLine1', a.address_line1,
            'addressLine2', a.address_line2,
            'city', a.city,
            'stateId', a.state_id,
            'countryId', a.country_id,
            'zipCode', a.zip_code
          )
        ) AS address
      FROM property p
      JOIN leads l ON l.leads_id = p.leads_id
      LEFT JOIN address a ON a.address_id = p.address_id
      ${whereClause}
      ORDER BY p.created_at DESC
    `;

    const result = await client.query(query, queryParams);

    const formattedData = result.rows.map(row => {
      const formatted = keysToCamelCase(row);
      delete formatted.addressId;
      return formatted;
    });

    return successResponse(
      res,
      formattedData,
      "Properties fetched successfully"
    );
  } catch (error) {
    console.error("Error fetching properties:", error);
    return errorResponse(res, error?.status || 500, error?.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.deleteProperty = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId && !companyId) {
      await client.query("ROLLBACK");
      return errorResponse(res, 401, "Unauthorized: User must belong to either a builder or company");
    }

    const { property_id } = req.params;

    const existing = await client.query(
      `SELECT p.property_id, p.address_id 
       FROM property p 
       JOIN leads l ON l.leads_id = p.leads_id 
       WHERE p.property_id = $1 AND (
        (l.company_id = $2 AND $2 IS NOT NULL)
        OR (l.builder_id = $3 AND $3 IS NOT NULL)
      )`,
      [property_id, companyId, builderId]
    );

    if (existing.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Property not found or does not belong to your organization.");
    }

    const addressId = existing.rows[0].address_id;

    await client.query(`DELETE FROM property WHERE property_id = $1`, [property_id]);

    if (addressId) {
      await client.query(`DELETE FROM address WHERE address_id = $1`, [addressId]);
    }

    await client.query("COMMIT");

    return successResponse(res, null, "Property deleted successfully");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error deleting property:", error);
    return errorResponse(res, error?.status || 500, error?.message || "Internal Server Error");
  } finally {
    client.release();
  }
};
