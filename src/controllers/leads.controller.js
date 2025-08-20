const getPool = require("../config/database");
const { successResponse, errorResponse } = require("../helper/response");

exports.createLead = async (req, res) => {
  const { name, email, phone, builderId, leadSource } = req.body;
  const pool = getPool();
  const client = await pool.connect();

  try {
    const query = `
      INSERT INTO leads (name, email, phone, builder_id, lead_source)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING lead_id, name, email, phone, lead_source, created_at;
    `;

    const result = await client.query(query, [
      name,
      email.toLowerCase(),
      phone || null,
      builderId || null,
      leadSource || "OTHER",
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
  const { limit = 25, offset = 0 } = req.query;

  const pool = getPool();
  const client = await pool.connect();

  try {
    const query = `
      SELECT lead_id, name, email, phone, status, lead_source, created_at, updated_at
      FROM leads
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2;
    `;

    const result = await client.query(query, [limit, offset]);

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

  const pool = getPool();
  const client = await pool.connect();

  try {
    const query = `
      SELECT lead_id, name, email, phone, status, lead_source, notes, created_at, updated_at
      FROM leads
      WHERE lead_id = $1;
    `;

    const result = await client.query(query, [id]);

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
