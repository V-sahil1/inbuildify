const getPool = require("../config/database");
const { errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");
const { successResponse } = require("../helper/response");


exports.createContractor = async (req, res) => {
  const requiredFields = ["name", "email", "phone", "address"];
  const requestBody = req.body || {};

  // Validate the request body
  if (!requestBody || Object.keys(requestBody).length === 0) {
    return errorResponse(res, 400, "Invalid request");
  }

  if (!checkRequiredFields(Object.keys(requestBody), requiredFields)) {
    return errorResponse(
      res,
      400,
      `Invalid request body, requireFields: ${requiredFields.join(", ")}`
    );
  }

  const { name, email, phone, address } = requestBody;
  const lowerCaseEmail = email.toLowerCase();

  const pool = getPool();
  const client = await pool.connect();

  try {
    // Check if builder exists
    const builderQuery = `SELECT  * FROM builder WHERE builder_id = $1;`;
    const builderResult = await client.query(builderQuery, [builderId]);

    if (builderResult.rows.length === 0) {
      return errorResponse(res, 404, "Builder not found with the provided ID.");
    }

    // Check if contractor already exists with the same email and builder
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

    const contractorQuery = `INSERT INTO contractor (name, email, builder_id, phone, address) VALUES ($1, $2, $3, $4, $5) RETURNING *;`;
    const contractorResult = await client.query(contractorQuery, [name, lowerCaseEmail, builderId, phone, address]);
    
    const createdContractor = contractorResult.rows[0];
    return successResponse(
      res,
      {
        ...createdContractor,
      },
      "Contractor created successfully."
    );


  } catch (error) {
    console.error('Create contractor error:', error);

    // Handle specific database errors
    if (error.code === '23505') { // Unique constraint violation
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
    const getContractorsQuery = `SELECT * FROM contractor WHERE builder_id = $1 AND is_deleted = false;`;
    const getContractorsResult = await client.query(getContractorsQuery, [builderId]);

    const contractorData = getContractorsResult.rows;
    console.log("🚀 ~ exports.getContractors= ~ contractorData:", contractorData)
    return successResponse(
      res,
      keysToCamelCase(contractorData),
      "Contractors fetched successfully."
    );
  } catch (error) {
    console.error({ error });
    return errorResponse(
      res,
      error.statusCode || 500,
      error.message || "Internal Server Error"
    );
  } finally {
    client.release();
  }
}

exports.getContractorById = async (req, res) => {
  const { id } = req.params;
  const builderId = req.user.builder_id;

  const pool = getPool();
  const client = await pool.connect();

  try {
    const getContractorByIdQuery = `SELECT * FROM contractor WHERE contractor_id = $1 AND builder_id = $2 AND is_deleted = false;`;
    const getContractorByIdResult = await client.query(getContractorByIdQuery, [id, builderId]);

    const contractorData = getContractorByIdResult.rows;
    return successResponse(
      res,
      keysToCamelCase(contractorData),
      "Contractor fetched successfully."
    );
  } catch (error) {
    console.error({ error });
    return errorResponse(
      res,
      error.statusCode || 500,
      error.message || "Internal Server Error"
    );
  } finally {
    client.release();
  }
};

exports.getContractors = async (req, res) => {
  const builderId = req.user.builder_id;

  const pool = getPool();
  const client = await pool.connect();

  try {
    const getContractorsQuery = `SELECT * FROM contractor WHERE builder_id = $1 AND is_deleted = false;`;
    const getContractorsResult = await client.query(getContractorsQuery, [builderId]);

    const contractorData = getContractorsResult.rows;
    console.log("🚀 ~ exports.getContractors= ~ contractorData:", contractorData)
    return successResponse(
      res,
      keysToCamelCase(contractorData),
      "Contractors fetched successfully."
    );
  } catch (error) {
    console.error({ error });
    return errorResponse(
      res,
      error.statusCode || 500,
      error.message || "Internal Server Error"
    );
  } finally {
    client.release();
  }
}

exports.getContractorById = async (req, res) => {
  const { id } = req.params;
  const builderId = req.user.builder_id;

  const pool = getPool();
  const client = await pool.connect();

  try {
    const getContractorByIdQuery = `SELECT * FROM contractor WHERE contractor_id = $1 AND builder_id = $2 AND is_deleted = false;`;
    const getContractorByIdResult = await client.query(getContractorByIdQuery, [id, builderId]);

    const contractorData = getContractorByIdResult.rows;
    return successResponse(
      res,
      keysToCamelCase(contractorData),
      "Contractor fetched successfully."
    );
  } catch (error) {
    console.error({ error });
    return errorResponse(
      res,
      error.statusCode || 500,
      error.message || "Internal Server Error"
    );
  } finally {
    client.release();
  }
}

exports.updateContractor = async (req, res) => {
  const { id } = req.params;
  console.log("🚀 ~ exports.updateContractor= ~ id:", id)
  const builderId = req.user.builder_id;
  const allowedFields = ["name", "phone", "address"]; 
  const updates = {};

  const invalidFields = Object.keys(req.body).filter(
    (key) => !allowedFields.includes(key)
  );

  if (invalidFields.length > 0) {
    return errorResponse(
      res,
      400,
      `Invalid field(s): ${invalidFields.join(", ")}. These field(s) cannot be updated.`
    );
  }

  for (const field of allowedFields) {
    const value = req.body[field];
    if (value !== undefined && value !== null) {
      if (typeof value === "string" && value.trim() === "") continue;
      updates[field] = typeof value === "string" ? value.trim() : value;
    }
  }

  if (Object.keys(updates).length === 0) {
    return errorResponse(res, 400, "No valid fields to update.");
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
    const checkBuilderQuery = `SELECT * FROM contractor WHERE contractor_id = $1 AND builder_id = $2 AND is_deleted = false;`;
    const checkBuilderResult = await client.query(checkBuilderQuery, [id, builderId]);
    
    if (checkBuilderResult.rowCount === 0) {
      return errorResponse(res, 404, "Contractor not found.");
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
    console.log("🚀 ~ exports.updateContractor= ~ updateQuery:", updateQuery)

    const result = await client.query(updateQuery, values);

    if (result.rowCount === 0) {
      return errorResponse(res, 404, "Contractor not found.");
    }

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
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

    return successResponse(
      res,
      {},
      "Contractor deleted successfully."
    );
  } catch (error) {
    console.error("Error deleting contractor:", error);
    return errorResponse(res, 500, "Internal Server Error");
  } finally {
    client.release();
  }
};


