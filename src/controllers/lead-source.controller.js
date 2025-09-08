const getPool = require("../config/database");
const { errorResponse, successResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.createLeadSource = async (req, res) => {
  const { name } = req.body || {};
  const builderId = req.user.builder_id;

  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderQuery = `SELECT * FROM builder WHERE builder_id = $1;`;
    const builderResult = await client.query(builderQuery, [builderId]);

    if (builderResult.rows.length === 0) {
      return errorResponse(res, 404, "Builder not found with the provided ID.");
    }

    const existingLeadSourceQuery = `
      SELECT lead_source_id, name FROM lead_source 
      WHERE LOWER(name) = $1 AND (builder_id = $2 OR builder_id IS NULL) AND is_deleted = false;
    `;
    const existingLeadSourceResult = await client.query(
      existingLeadSourceQuery,
      [name.toLowerCase(), builderId]
    );

    if (existingLeadSourceResult.rows.length > 0) {
      return errorResponse(res, 409, "Lead source already exists.");
    }

    const leadSourceQuery = `
      INSERT INTO lead_source (name, builder_id) 
      VALUES ($1, $2) 
      RETURNING lead_source_id, name, builder_id, created_at, updated_at;
    `;
    const leadSourceResult = await client.query(leadSourceQuery, [
      name,
      builderId,
    ]);

    return successResponse(
      res,
      keysToCamelCase(leadSourceResult.rows[0]),
      "Lead source created successfully."
    );
  } catch (error) {
    console.error("Create lead source error:", error);

    if (error.code === "23505") {
      return errorResponse(res, 409, "Lead source already exists.");
    }

    return errorResponse(res, 500, "Failed to create lead source.");
  } finally {
    client.release();
  }
};

exports.getLeadSources = async (req, res) => {
  const builderId = req.user.builder_id;
  const pool = getPool();
  const client = await pool.connect();

  try {
    const query = `
      SELECT lead_source_id, name, builder_id, created_at, updated_at FROM lead_source 
      WHERE (builder_id IS NULL OR builder_id = $1) AND is_deleted = false
      ORDER BY created_at DESC;
    `;
    const result = await client.query(query, [builderId]);

    return successResponse(
      res,
      keysToCamelCase(result.rows),
      "Lead sources retrieved successfully."
    );
  } catch (error) {
    console.error("Get lead sources error:", error);
    return errorResponse(res, 500, "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.getLeadSourceById = async (req, res) => {
  const { lead_source_id } = req.params;
  const builderId = req.user.builder_id;

  const pool = getPool();
  const client = await pool.connect();

  try {
    const query = `
      SELECT lead_source_id, name, builder_id, created_at, updated_at FROM lead_source 
      WHERE lead_source_id = $1 AND (builder_id IS NULL OR builder_id = $2) AND is_deleted = false;
    `;
    const result = await client.query(query, [lead_source_id, builderId]);

    if (result.rowCount === 0) {
      return errorResponse(res, 404, "Lead source not found.");
    }

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Lead source fetched successfully."
    );
  } catch (error) {
    console.error("Get lead source by ID error:", error);
    return errorResponse(res, 500, "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.updateLeadSource = async (req, res) => {
  const { lead_source_id } = req.params;
  const builderId = req.user.builder_id;
  const { name } = req.body;

  const pool = getPool();
  const client = await pool.connect();

  try {
    const checkLeadSourceQuery = `
      SELECT * FROM lead_source 
      WHERE lead_source_id = $1 AND builder_id = $2 AND is_deleted = false;
    `;
    const checkLeadSourceResult = await client.query(checkLeadSourceQuery, [
      lead_source_id,
      builderId,
    ]);

    if (checkLeadSourceResult.rowCount === 0) {
      return errorResponse(
        res,
        404,
        "Lead source not found or you don't have permission to update this lead source."
      );
    }

    const existingLeadSourceQuery = `
      SELECT lead_source_id FROM lead_source 
      WHERE LOWER(name) = $1 AND (builder_id = $2 OR builder_id IS NULL) 
      AND lead_source_id != $3 AND is_deleted = false;
    `;
    const existingLeadSourceResult = await client.query(
      existingLeadSourceQuery,
      [name.toLowerCase(), builderId, lead_source_id]
    );

    if (existingLeadSourceResult.rows.length > 0) {
      return errorResponse(res, 409, "Lead source name already exists.");
    }

    const updateQuery = `
      UPDATE lead_source 
      SET name = $1, updated_at = NOW()
      WHERE lead_source_id = $2 AND builder_id = $3
      RETURNING lead_source_id, name, builder_id, created_at, updated_at;
    `;

    const updateResult = await client.query(updateQuery, [
      name,
      lead_source_id,
      builderId,
    ]);

    if (updateResult.rowCount === 0) {
      return errorResponse(res, 404, "Lead source not found.");
    }

    return successResponse(
      res,
      keysToCamelCase(updateResult.rows[0]),
      "Lead source updated successfully."
    );
  } catch (error) {
    console.error("Error updating lead source:", error);

    if (error.code === "23505") {
      return errorResponse(res, 409, "Lead source name already exists.");
    }

    return errorResponse(res, 500, "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.deleteLeadSource = async (req, res) => {
  const { lead_source_id } = req.params;
  const builderId = req.user.builder_id;

  const pool = getPool();
  const client = await pool.connect();

  try {
    const checkLeadSourceQuery = `
      SELECT * FROM lead_source 
      WHERE lead_source_id = $1 AND builder_id = $2 AND is_deleted = false;
    `;
    const checkLeadSourceResult = await client.query(checkLeadSourceQuery, [
      lead_source_id,
      builderId,
    ]);

    if (checkLeadSourceResult.rowCount === 0) {
      return errorResponse(
        res,
        404,
        "Lead source not found or you don't have permission to delete this lead source."
      );
    }

    const deleteQuery = `
      UPDATE lead_source 
      SET is_deleted = true, updated_at = NOW()
      WHERE lead_source_id = $1 AND builder_id = $2;
    `;
    const deleteResult = await client.query(deleteQuery, [lead_source_id, builderId]);

    if (deleteResult.rowCount === 0) {
      return errorResponse(res, 404, "Lead source not found.");
    }

    return successResponse(res, {}, "Lead source deleted successfully.");
  } catch (error) {
    console.error("Error deleting lead source:", error);
    return errorResponse(res, 500, "Internal Server Error");
  } finally {
    client.release();
  }
};
