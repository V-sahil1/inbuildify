const getPool = require("../../config/database");
const { successResponse, errorResponse } = require("../../helper/response");
const { keysToCamelCase } = require("../../utils/common");

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

    // Validate lead ownership
    const leadCheck = await client.query(
      `SELECT leads_id FROM leads WHERE leads_id = $1 AND (
        (company_id = $2 AND $2 IS NOT NULL)
        OR (builder_id = $3 AND $3 IS NOT NULL)
      ) LIMIT 1`,
      [leads_id, companyId, builderId]
    );

    if (leadCheck.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Lead not found or does not belong to your organization");
    }

    // Check existing contacts for this lead and contact type
    const existingContactsCheck = await client.query(
      `SELECT COUNT(*) as count FROM business_contact 
       WHERE leads_id = $1 AND contact_type = $2`,
      [leads_id, contact_type]
    );

    const existingCount = parseInt(existingContactsCheck.rows[0].count);

    // Check contacts per type for this lead
    const contactsByTypeCheck = await client.query(
      `SELECT contact_type, COUNT(*) as count FROM business_contact 
       WHERE leads_id = $1 
       GROUP BY contact_type`,
      [leads_id]
    );

    const parsedCountryId = country_id === "" ? null : country_id;
    const parsedStateId = state_id === "" ? null : state_id;

    if (parsedStateId) {
      if (!parsedCountryId) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Country is required when state is provided.");
      }

      const stateCheckRes = await client.query(
        "SELECT 1 FROM state WHERE state_id = $1 AND country_id = $2",
        [parsedStateId, parsedCountryId]
      );

      if (stateCheckRes.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Invalid state for the selected country.");
      }
    }

    const typeCounts = {};
    contactsByTypeCheck.rows.forEach(row => {
      typeCounts[row.contact_type] = parseInt(row.count);
    });

    // Validation rules
    if (typeCounts[contact_type] >= 1) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, `Only one contact allowed per type. Type '${contact_type}' already has ${typeCounts[contact_type]} contact(s)`);
    }

    // Check total contacts for this lead (max 4)
    const totalContactsCheck = await client.query(
      `SELECT COUNT(*) as total FROM business_contact WHERE leads_id = $1`,
      [leads_id]
    );

    const totalContacts = parseInt(totalContactsCheck.rows[0].total);
    if (totalContacts >= 4) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "Maximum 4 contacts allowed per lead. This lead already has " + totalContacts + " contacts");
    }

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

    const finalCountryId = country_id !== undefined ? (country_id === "" ? null : country_id) : checkResult.rows[0].country_id;
    const finalStateId = state_id !== undefined ? (state_id === "" ? null : state_id) : checkResult.rows[0].state_id;

    if (finalStateId) {
      if (!finalCountryId) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Country is required when state is provided.");
      }

      const stateCheckRes = await client.query(
        "SELECT 1 FROM state WHERE state_id = $1 AND country_id = $2",
        [finalStateId, finalCountryId]
      );

      if (stateCheckRes.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Invalid state for the selected country.");
      }
    }

    const fields = [];
    const values = [];
    let index = 1;

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

    const updateQuery = `
      UPDATE business_contact
      SET ${fields.join(", ")}
      WHERE business_contact_id = $${index}
      RETURNING *
    `;

    const finalValues = [...values, business_contact_id];
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

exports.getBusinessContactsByLeadsId = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;
    const { leads_id } = req.params;

    if (!builderId && !companyId) {
      return errorResponse(res, 401, "Unauthorized: User must belong to either a builder or company");
    }

    // Validate lead ownership
    const leadCheck = await client.query(
      `SELECT leads_id FROM leads WHERE leads_id = $1 AND (
        (company_id = $2 AND $2 IS NOT NULL)
        OR (builder_id = $3 AND $3 IS NOT NULL)
      ) LIMIT 1`,
      [leads_id, companyId, builderId]
    );

    if (leadCheck.rowCount === 0) {
      return errorResponse(res, 404, "Lead not found or does not belong to your organization");
    }

    const sql = `
      SELECT bc.*
      FROM business_contact bc
      WHERE bc.leads_id = $1
      ORDER BY bc.created_at DESC
    `;

    const result = await client.query(sql, [leads_id]);

    return successResponse(
      res,
      keysToCamelCase(result.rows),
      "Business contacts retrieved successfully"
    );
  } catch (error) {
    console.error("Get business contacts by leads ID error:", error);
    return errorResponse(res, 500, error?.message || "Internal Server Error");
  } finally {
    client.release();
  }
};
