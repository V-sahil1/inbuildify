const getPool = require("../config/database");
const { errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");
const { successResponse } = require("../helper/response");

exports.createContractor = async (req, res) => {
  const { name, email, phone, address, service } = req.body || {};
  const builderId = req.user.builder_id;
  const lowerCaseEmail = email.toLowerCase();

  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderQuery = `SELECT  * FROM builder WHERE builder_id = $1;`;
    const builderResult = await client.query(builderQuery, [builderId]);
    console.log("🚀 ~ contractor.controller.js:17 ~ builderResult:", builderResult);

    if (builderResult.rows.length === 0) {
      return errorResponse(res, 404, "Builder not found with the provided ID.");
    }

    const existingContractorQuery = `
      SELECT contractor_id, email FROM contractor 
      WHERE LOWER(email) = $1 AND builder_id = $2;
    `;
    const existingContractorResult = await client.query(existingContractorQuery, [
      lowerCaseEmail, 
      builderId
    ]);

    if (existingContractorResult.rows.length > 0) {
      return errorResponse(res, 409, "Contractor with this email already exists for this builder.");
    }

    let serviceId;
    const serviceQuery = `SELECT * FROM service WHERE service = $1 AND (builder_id = $2 OR builder_id IS NULL);`;
    const serviceResult = await client.query(serviceQuery, [service, builderId]);

    if (serviceResult.rows.length === 0) {
      const serviceCreateQuery = `INSERT INTO service (service, builder_id) VALUES ($1, $2) RETURNING *;`;
      const serviceCreateResult = await client.query(serviceCreateQuery, [service, builderId]);
      serviceId = serviceCreateResult.rows[0].service_id;
    } else {
      serviceId = serviceResult.rows[0].service_id;
    }
    
    const contractorQuery = `INSERT INTO contractor (name, email, builder_id, phone, address, service_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *;`;
    const contractorResult = await client.query(contractorQuery, [name, lowerCaseEmail, builderId, phone, address, serviceId]);
    
    const createdContractor = {
      ...contractorResult.rows[0],
      service
    };
    return successResponse(
      res,
      keysToCamelCase(createdContractor),
      "Contractor created successfully."
    );
  } catch (error) {
    console.error('Create contractor error:', error);

    if (error.code === '23505') {
      return errorResponse(res, 409, "Contractor with this email already exists.");
    }
    
    return errorResponse(res, 500, "Failed to create contractor.");
  } finally {
    client.release();
  }
};

exports.getContractors = async (req, res) => {
  const builderId = req.user.builder_id;
  const pool = getPool();
  const client = await pool.connect();

  try {
    const query = `
      SELECT c.*, s.service FROM contractor c
      LEFT JOIN service s ON c.service_id = s.service_id
      WHERE c.builder_id = $1 AND c.is_deleted = false;
    `;
    const result = await client.query(query, [builderId]);

    return successResponse(
      res,
      keysToCamelCase(result.rows),
      "Contractors fetched successfully."
    );
  } catch (error) {
    console.error("Get contractors error:", error);
    return errorResponse(res, 500, "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.getContractorById = async (req, res) => {
  const { id } = req.params;
  const builderId = req.user.builder_id;

  const pool = getPool();
  const client = await pool.connect();

  try {
    const query = `
      SELECT c.*, s.service FROM contractor c
      LEFT JOIN service s ON c.service_id = s.service_id
      WHERE c.contractor_id = $1 AND c.builder_id = $2 AND c.is_deleted = false;
    `;
    const result = await client.query(query, [id, builderId]);

    if (result.rowCount === 0) {
      return errorResponse(res, 404, "Contractor not found.");
    }

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Contractor fetched successfully."
    );
  } catch (error) {
    console.error("Get contractor by ID error:", error);
    return errorResponse(res, 500, "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.updateContractor = async (req, res) => {
  const { id } = req.params;
  const builderId = req.user.builder_id;
  const updates = req.body;

  const pool = getPool();
  const client = await pool.connect();

  try {
    const checkBuilderQuery = `SELECT * FROM contractor WHERE contractor_id = $1 AND builder_id = $2 AND is_deleted = false;`;
    const checkBuilderResult = await client.query(checkBuilderQuery, [id, builderId]);
    
    if (checkBuilderResult.rowCount === 0) {
      return errorResponse(res, 404, "Contractor not found.");
    }

    if (updates.service) {
      const serviceQuery = `
        SELECT service_id 
        FROM service 
        WHERE service = $1 AND (builder_id = $2 OR builder_id IS NULL)
        LIMIT 1;
      `;
      const serviceResult = await client.query(serviceQuery, [updates.service, builderId]);

      if (serviceResult.rowCount === 0) {
        return errorResponse(res, 400, `Service '${updates.service}' not found.`);
      }

      updates.service_id = serviceResult.rows[0].service_id;
      delete updates.service;
    }

    const setClauses = [];
    const values = [];
    let idx = 1;

    for (const [key, value] of Object.entries(updates)) {
      setClauses.push(`${key} = $${idx}`);
      values.push(value);
      idx++;
    }

    values.push(id, builderId);

    const updateQuery = `
      UPDATE contractor 
      SET ${setClauses.join(", ")}, updated_at = NOW()
      WHERE contractor_id = $${idx} AND builder_id = $${idx + 1}
      RETURNING *;
    `;

    const updateResult = await client.query(updateQuery, values);

    if (updateResult.rowCount === 0) {
      return errorResponse(res, 404, "Contractor not found.");
    }

    const serviceResult = await client.query(`SELECT service FROM service WHERE service_id = $1 LIMIT 1;`, [updateResult.rows[0].service_id]);
    const serviceName = serviceResult.rowCount > 0 ? serviceResult.rows[0].service : null;
    updateResult.rows[0].service = serviceName;

    return successResponse(
      res,
      keysToCamelCase(updateResult.rows[0]),
      "Contractor updated successfully."
    );

  } catch (error) {
    console.error("Error updating contractor:", error);
    return errorResponse(res, 500, "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.deleteContractor = async (req, res) => {
  const { id } = req.params;
  const builderId = req.user.builder_id;

  const pool = getPool();
  const client = await pool.connect();

  try {
    const checkBuilderQuery = `SELECT * FROM contractor WHERE contractor_id = $1 AND builder_id = $2 AND is_deleted = false;`;
    const checkBuilderResult = await client.query(checkBuilderQuery, [id, builderId]);
    
    if (checkBuilderResult.rowCount === 0) {
      return errorResponse(res, 404, "Contractor not found.");
    }

    const deleteQuery = `UPDATE contractor set is_deleted = true where contractor_id = $1 AND builder_id = $2;`;
    const deleteResult = await client.query(deleteQuery, [id, builderId]);

    if (deleteResult.rowCount === 0) {
      return errorResponse(res, 404, "Contractor not found.");
    }

    return successResponse(res, {}, "Contractor deleted successfully.");
  } catch (error) {
    console.error("Error deleting contractor:", error);
    return errorResponse(res, 500, "Internal Server Error");
  } finally {
    client.release();
  }
};
