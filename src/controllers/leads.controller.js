const getPool = require("../config/database");
const { successResponse, errorResponse } = require("../helper/response");
const { v4: uuidv4 } = require("uuid");

exports.createLead = async (req, res) => {
  const { name, email, phone, builderId, leadSource } = req.body;
  const pool = getPool();
  const client = await pool.connect();

  try {
    const formToken = uuidv4(); // unique token for frontend form link

    const query = `
      INSERT INTO leads (name, email, phone, builder_id, lead_source, form_token)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING lead_id, name, email, phone, lead_source, form_token, created_at;
    `;

    const result = await client.query(query, [
      name,
      email.toLowerCase(),
      phone || null,
      builderId || null,
      leadSource || "OTHER",
      formToken,
    ]);

    return successResponse(res, result.rows[0], "Lead created successfully.");
  } catch (error) {
    console.error("Create lead error:", error);
    return errorResponse(res, 500, "Failed to create lead.");
  } finally {
    client.release();
  }
};

exports.getLeads = async (req, res) => {
  const builderId = req.user?.builder_id; // restrict by builder
  const { limit = 25, offset = 0 } = req.query;

  const pool = getPool();
  const client = await pool.connect();

  try {
    const query = `
      SELECT lead_id, name, email, phone, status, lead_source, created_at, updated_at
      FROM leads
      WHERE ($1::UUID IS NULL OR builder_id = $1)
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3;
    `;

    const result = await client.query(query, [builderId || null, limit, offset]);

    return successResponse(res, result.rows, "Leads fetched successfully.");
  } catch (error) {
    console.error("Get leads error:", error);
    return errorResponse(res, 500, "Failed to fetch leads.");
  } finally {
    client.release();
  }
};

exports.getLeadById = async (req, res) => {
  const { id } = req.params;
  const builderId = req.user?.builder_id;

  const pool = getPool();
  const client = await pool.connect();

  try {
    const query = `
      SELECT lead_id, name, email, phone, status, lead_source, form_data, notes, created_at, updated_at
      FROM leads
      WHERE lead_id = $1 AND ($2::UUID IS NULL OR builder_id = $2);
    `;

    const result = await client.query(query, [id, builderId || null]);

    if (result.rowCount === 0) {
      return errorResponse(res, 404, "Lead not found.");
    }

    return successResponse(res, result.rows[0], "Lead fetched successfully.");
  } catch (error) {
    console.error("Get lead by ID error:", error);
    return errorResponse(res, 500, "Failed to fetch lead.");
  } finally {
    client.release();
  }
};
