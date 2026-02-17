const getPool = require("../config/database");

const { successResponse, errorResponse } = require("../helper/response");

const { keysToCamelCase } = require("../utils/common");

exports.createBusinessContact = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const createdBy = req.user?.user_id;

    const {
      leads_id,
      contact_type,
      name,
      email,
      phone,
      address1,
      address2,
      city,
      zip_code,
      country_id,
      state_id,
      abn_number,
      acn_number,
    } = req.body;

    // No authorization check needed as business_contact doesn't have builder_id/company_id

    const insertQuery = `
      INSERT INTO business_contact (
        leads_id,
        contact_type,
        name,
        email,
        phone,
        address1,
        address2,
        city,
        zip_code,
        country_id,
        state_id,
        abn_number,
        acn_number
      
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING *
    `;

    const result = await client.query(insertQuery, [
      leads_id,
      contact_type,
      name,
      email,
      phone,
      address1,
      address2,
      city,
      zip_code,
      country_id,
      state_id,
      abn_number,
      acn_number,
    ]);

    await client.query("COMMIT");

    const transformed = keysToCamelCase(result.rows[0]);

    return successResponse(
      res,
      transformed,
      "Business contact created successfully.",
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error creating business contact:", err);
    return errorResponse(res, 500, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.getAllBusinessContacts = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId && !companyId) {
      return errorResponse(
        res,
        401,
        "Unauthorized: Missing builder or company ID.",
      );
    }

    let { page = 1, limit = 25 } = req.query;
    page = parseInt(page);
    limit = parseInt(limit);

    const offset = (page - 1) * limit;

    const { name, email, phone, contact_type, city, country_id, state_id } =
      req.query;

    let whereClauses = [];
    let values = [];
    let idx = 1;

    // Add builder/company filtering through leads table
    if (builderId) {
      whereClauses.push(`l.builder_id = $${idx}`);
      values.push(builderId);
      idx++;
    } else {
      whereClauses.push(`l.company_id = $${idx}`);
      values.push(companyId);
      idx++;
    }

    if (name) {
      whereClauses.push(`LOWER(bc.name) LIKE LOWER($${idx})`);
      values.push(`%${name}%`);
      idx++;
    }

    if (email) {
      whereClauses.push(`LOWER(bc.email) LIKE LOWER($${idx})`);
      values.push(`%${email}%`);
      idx++;
    }

    if (phone) {
      whereClauses.push(`bc.phone = $${idx}`);
      values.push(phone);
      idx++;
    }

    if (contact_type) {
      whereClauses.push(`bc.contact_type = $${idx}`);
      values.push(contact_type);
      idx++;
    }

    if (city) {
      whereClauses.push(`LOWER(bc.city) LIKE LOWER($${idx})`);
      values.push(`%${city}%`);
      idx++;
    }

    if (country_id) {
      whereClauses.push(`bc.country_id = $${idx}`);
      values.push(country_id);
      idx++;
    }

    if (state_id) {
      whereClauses.push(`bc.state_id = $${idx}`);
      values.push(state_id);
      idx++;
    }

    const where =
      whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    const countQuery = `
      SELECT COUNT(*) 
      FROM business_contact bc
      INNER JOIN leads l ON bc.leads_id = l.leads_id
      ${where}
    `;
    const countResult = await client.query(countQuery, values);
    const total = parseInt(countResult.rows[0].count);

    const dataQuery = `
      SELECT 
        bc.*,
        c.name as country_name,
        s.name as state_name
      FROM business_contact bc
      INNER JOIN leads l ON bc.leads_id = l.leads_id
      LEFT JOIN country c ON bc.country_id = c.country_id
      LEFT JOIN state s ON bc.state_id = s.state_id
      ${where}
      ORDER BY bc.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const result = await client.query(dataQuery, values);

    const transformedRows = result.rows.map((row) => {
      const transformed = keysToCamelCase(row);
      return {
        ...transformed,
      };
    });

    return successResponse(res, {
      businessContacts: transformedRows,
      pagination: {
        totalRecords: total,
        currentPage: page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("Error fetching business contacts:", err);
    return errorResponse(res, 500, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.getBusinessContactById = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const { business_contact_id } = req.params;

    if (!builderId && !companyId) {
      return errorResponse(
        res,
        401,
        "Unauthorized: Missing builder or company ID.",
      );
    }

    const query = `
      SELECT 
        bc.*,
        c.name as country_name,
        s.name as state_name
      FROM business_contact bc
      INNER JOIN leads l ON bc.leads_id = l.leads_id
      LEFT JOIN country c ON bc.country_id = c.country_id
      LEFT JOIN state s ON bc.state_id = s.state_id
      WHERE bc.business_contact_id = $1
        AND (l.company_id = $2 OR l.builder_id = $3)
    `;

    const result = await client.query(query, [
      business_contact_id,
      companyId,
      builderId,
    ]);

    if (result.rowCount === 0) {
      return errorResponse(res, 404, "Business contact not found.");
    }

    const transformed = keysToCamelCase(result.rows[0]);

    return successResponse(
      res,
      transformed,
      "Business contact retrieved successfully.",
    );
  } catch (err) {
    console.error("Error fetching business contact:", err);
    return errorResponse(res, 500, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.updateBusinessContact = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.user_id;
    const { business_contact_id } = req.params;

    if (!builderId && !companyId) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        401,
        "Unauthorized: Missing builder or company ID.",
      );
    }

    const {
      contact_type,
      name,
      email,
      phone,
      address1,
      address2,
      city,
      zip_code,
      country_id,
      state_id,
      abn_number,
      acn_number,
    } = req.body;

    const checkQuery = `
      SELECT bc.*
      FROM business_contact bc
      INNER JOIN leads l ON bc.leads_id = l.leads_id
      WHERE bc.business_contact_id = $1
        AND (l.company_id = $2 OR l.builder_id = $3)
    `;

    const checkResult = await client.query(checkQuery, [
      business_contact_id,
      companyId,
      builderId,
    ]);

    if (checkResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Business contact not found.");
    }

    const fields = [];
    const values = [];
    let index = 1;

    if (contact_type !== undefined) {
      fields.push(`contact_type = $${index}`);
      values.push(contact_type);
      index++;
    }

    if (name !== undefined) {
      fields.push(`name = $${index}`);
      values.push(name);
      index++;
    }

    if (email !== undefined) {
      fields.push(`email = $${index}`);
      values.push(email);
      index++;
    }

    if (phone !== undefined) {
      fields.push(`phone = $${index}`);
      values.push(phone);
      index++;
    }

    if (address1 !== undefined) {
      fields.push(`address1 = $${index}`);
      values.push(address1);
      index++;
    }

    if (address2 !== undefined) {
      fields.push(`address2 = $${index}`);
      values.push(address2);
      index++;
    }

    if (city !== undefined) {
      fields.push(`city = $${index}`);
      values.push(city);
      index++;
    }

    if (zip_code !== undefined) {
      fields.push(`zip_code = $${index}`);
      values.push(zip_code);
      index++;
    }

    if (country_id !== undefined) {
      fields.push(`country_id = $${index}`);
      values.push(country_id);
      index++;
    }

    if (state_id !== undefined) {
      fields.push(`state_id = $${index}`);
      values.push(state_id);
      index++;
    }

    if (abn_number !== undefined) {
      fields.push(`abn_number = $${index}`);
      values.push(abn_number);
      index++;
    }

    if (acn_number !== undefined) {
      fields.push(`acn_number = $${index}`);
      values.push(acn_number);
      index++;
    }

    if (fields.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "No fields to update");
    }

    fields.push(`updated_at = NOW()`);
    fields.push(`updated_by = $${index}`);
    values.push(userId);
    index++;

    const updateQuery = `
      UPDATE business_contact
      SET ${fields.join(", ")}
      WHERE business_contact_id = $${index}
      RETURNING *
    `;

    const finalValues = [business_contact_id, ...values];
    const updateResult = await client.query(updateQuery, finalValues);

    await client.query("COMMIT");

    const transformed = keysToCamelCase(updateResult.rows[0]);

    return successResponse(
      res,
      transformed,
      "Business contact updated successfully.",
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error updating business contact:", err);
    return errorResponse(res, 500, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.deleteBusinessContact = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.user_id;
    const { business_contact_id } = req.params;

    if (!builderId && !companyId) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        401,
        "Unauthorized: Missing builder or company ID.",
      );
    }

    const checkQuery = `
      SELECT bc.*
      FROM business_contact bc
      INNER JOIN leads l ON bc.leads_id = l.leads_id
      WHERE bc.business_contact_id = $1
        AND (l.company_id = $2 OR l.builder_id = $3)
    `;

    const checkResult = await client.query(checkQuery, [
      business_contact_id,
      companyId,
      builderId,
    ]);

    if (checkResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Business contact not found.");
    }

    // Remove ownership check as table doesn't have builder_id/company_id

    await client.query(
      `DELETE FROM business_contact WHERE business_contact_id = $1`,
      [business_contact_id],
    );

    await client.query("COMMIT");

    return successResponse(res, {}, "Business contact deleted successfully.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error deleting business contact:", err);
    return errorResponse(res, 500, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
};
