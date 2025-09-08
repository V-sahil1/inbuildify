const getPool = require("../config/database");
const { successResponse, errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.getLeadContacts = async (req, res) => {
  const { lead_id } = req.params;
  const builderId = req.user.builder_id;
  const pool = getPool();
  const client = await pool.connect();

  try {
    const query = `
      SELECT c.*, co.name as country_name, s.name as state_name
      FROM leads_contact c
      LEFT JOIN country co ON c.country_id = co.country_id
      LEFT JOIN state s ON c.state_id = s.state_id
      INNER JOIN leads l ON c.lead_id = l.lead_id
      WHERE c.lead_id = $1 AND l.builder_id = $2 AND l.is_deleted = false
      ORDER BY c.created_at ASC;
    `;
    const result = await client.query(query, [lead_id, builderId]);
    return successResponse(res, result.rows, "Lead contacts fetched successfully.");
  } catch (err) {
    console.error("Get lead contacts error:", err);
    return errorResponse(res, 500, "Failed to fetch lead contacts.");
  } finally {
    client.release();
  }
};

exports.getLeadContactById = async (req, res) => {
  const { lead_contact_id } = req.params;
  const builderId = req.user.builder_id;
  const pool = getPool();
  const client = await pool.connect();

  try {
    const query = `
      SELECT 
        c.leads_contact_id,
        c.lead_id,
        c.name,
        c.email,
        c.phone,
        c.secondry_phone,
        c.address1,
        c.address2,
        c.city,
        c.zip,
        c.country_id,
        co.name AS country_name,
        c.state_id,
        s.name AS state_name,
        c.created_at,
        c.updated_at
      FROM leads_contact c
      INNER JOIN leads l ON c.lead_id = l.lead_id
      LEFT JOIN country co ON c.country_id = co.country_id
      LEFT JOIN state s ON c.state_id = s.state_id
      WHERE c.leads_contact_id = $1 
        AND l.builder_id = $2 
        AND l.is_deleted = false;
    `;
  
    const result = await client.query(query, [lead_contact_id, builderId]);
  
    if (result.rowCount === 0) {
      return errorResponse(res, 404, "Lead contact not found.");
    }

    return successResponse(res, result.rows[0], "Lead contact fetched successfully.");
  } catch (err) {
    console.error("Get lead contact by id error:", err);
    return errorResponse(res, 500, "Failed to fetch lead contact.");
  } finally {
    client.release();
  }
};

exports.createLeadContact = async (req, res) => {
  const { lead_id } = req.params;
  const {
    name,
    email,
    phone,
    secondary_phone,
    address1,
    address2,
    city,
    zip,
    country,
    state
  } = req.body;

  const builderId = req.user.builder_id;
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const leadCheck = await client.query(
      `SELECT lead_id FROM leads WHERE lead_id = $1 AND builder_id = $2 AND is_deleted = false`,
      [lead_id, builderId]
    );
    if (leadCheck.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Lead not found.");
    }

    let countryId = null;
    let stateId = null;

    if (country) {
      const countryRes = await client.query(
        `SELECT country_id FROM country WHERE name = $1 LIMIT 1`,
        [country]
      );
      if (countryRes.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 404, "Country not found.");
      }
      countryId = countryRes.rows[0].country_id;
    }

    if (state) {
      const stateRes = await client.query(
        `SELECT s.state_id
         FROM state s
         INNER JOIN country c ON s.country_id = c.country_id
         WHERE s.name = $1 AND c.name = $2 LIMIT 1`,
        [state, country]
      );
      if (stateRes.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 404, "State not found.");
      }
      stateId = stateRes.rows[0].state_id;
    }

    const insertQuery = `
      INSERT INTO leads_contact
        (lead_id, name, email, phone, secondary_phone, address1, address2, city, zip, country_id, state_id)
      VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING leads_contact_id, lead_id, name, email, phone, secondary_phone,
                address1, address2, city, zip, country_id, state_id, created_at, updated_at;
    `;
    const result = await client.query(insertQuery, [
      lead_id,
      name,
      email ? email.toLowerCase() : null,
      phone || null,
      secondary_phone || null,
      address1 || null,
      address2 || null,
      city || null,
      zip || null,
      countryId,
      stateId
    ]);

    await client.query("COMMIT");

    return successResponse(res, keysToCamelCase(result.rows[0]), "Lead contact created successfully.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Create lead_contact error:", err);
    return errorResponse(res, 500, "Failed to create lead contact.");
  } finally {
    client.release();
  }
};

exports.updateLeadContact = async (req, res) => {
  const { lead_contact_id } = req.params;
  const {
    name,
    email,
    phone,
    secondary_phone,
    address1,
    address2,
    city,
    zip,
    country,
    state
  } = req.body;

  const builderId = req.user.builder_id;
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const contactCheck = await client.query(
      `SELECT c.leads_contact_id, c.lead_id FROM leads_contact c
       LEFT JOIN leads l ON c.lead_id = l.lead_id
       WHERE c.leads_contact_id = $1 AND l.builder_id = $2 AND l.is_deleted = false`,
      [lead_contact_id, builderId]
    );
    if (contactCheck.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "Lead contact not found.");
    }

    let countryId = null;
    let stateId = null;
    let countryName = null;
    let stateName = null;

    if (country) {
      const countryRes = await client.query(
        `SELECT country_id, name as country_name FROM country WHERE name = $1 LIMIT 1`,
        [country]
      );
      if (countryRes.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 404, "Country not found.");
      }
      countryId = countryRes.rows[0].country_id;
      countryName = countryRes.rows[0].country_name;
    }

    if (state) {
      const stateRes = await client.query(
        `SELECT s.state_id, s.name as state_name
         FROM state s
         INNER JOIN country c ON s.country_id = c.country_id
         WHERE s.name = $1 AND c.name = $2 LIMIT 1`,
        [state, country]
      );
      if (stateRes.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 404, "State not found.");
      }
      stateId = stateRes.rows[0].state_id;
      stateName = stateRes.rows[0].state_name;
    }

    const fields = [];
    const values = [];
    let idx = 1;

    if (name !== undefined) {
      fields.push(`name = $${idx++}`); values.push(name);
    }
    if (email !== undefined) {
      fields.push(`email = $${idx++}`); values.push(email);
    }
    if (phone !== undefined) {
      fields.push(`phone = $${idx++}`); values.push(phone);
    }
    if (secondary_phone !== undefined) {
      fields.push(`secondary_phone = $${idx++}`); values.push(secondary_phone);
    }
    if (address1 !== undefined) {
      fields.push(`address1 = $${idx++}`); values.push(address1);
    }
    if (address2 !== undefined) {
      fields.push(`address2 = $${idx++}`); values.push(address2);
    }
    if (city !== undefined) {
      fields.push(`city = $${idx++}`); values.push(city);
    }
    if (zip !== undefined) {
      fields.push(`zip = $${idx++}`); values.push(zip);
    }
    if (countryId) {
      fields.push(`country_id = $${idx++}`); values.push(countryId);
    }
    if (stateId) {
      fields.push(`state_id = $${idx++}`); values.push(stateId);
    }

    if (fields.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "At least one field is required for update.");
    }

    fields.push(`updated_at = NOW()`);

    const updateQuery = `
      UPDATE leads_contact
      SET ${fields.join(", ")}
      WHERE leads_contact_id = $${idx} AND lead_id = $${idx + 1}
      RETURNING *;
    `;
    values.push(lead_contact_id, contactCheck.rows[0].lead_id);

    const result = await client.query(updateQuery, values);

    if (!countryId && result.rows[0].country_id) {
      const oldCountryName = await client.query(
        `SELECT name as country_name FROM country WHERE country_id = $1 LIMIT 1`,
        [result.rows[0].country_id]
      );
      countryId = result.rows[0].country_id;
      countryName = oldCountryName.rows[0]?.country_name || null;
    }
    if (!stateId && result.rows[0].state_id) {
      const oldStateName = await client.query(
        `SELECT name as state_name FROM state WHERE state_id = $1 LIMIT 1`,
        [result.rows[0].state_id]
      );
      stateId = result.rows[0].state_id;
      stateName = oldStateName.rows[0]?.state_name || null;
    }

    await client.query("COMMIT");

    const responseData = {
      ...result.rows[0],
      country_name: countryName,
      state_name: stateName,
    };
    return successResponse(res, keysToCamelCase(responseData), "Lead contact updated successfully.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Update lead_contact error:", err);
    return errorResponse(res, 500, "Failed to update lead contact.");
  } finally {
    client.release();
  }
};
