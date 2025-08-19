const getPool = require("../config/database");
const { errorResponse } = require("../helper/response");
const { successResponse } = require("../helper/response");

exports.createContractor = async (req, res) => {
  const { name, email, builderId, phone, address } = req.body || {};
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
