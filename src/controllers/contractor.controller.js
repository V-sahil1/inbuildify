const getPool = require("../config/database");
const { errorResponse } = require("../helper/response");
const { checkRequiredFields, checkValidEmail } = require("../utils/common");
const { successResponse } = require("../helper/response");
const sendEmail = require("../helper/sendMail");

exports.createContractor = async (req, res) => {
  const requiredFields = ["name", "email", "builderId", "phone", "address"];
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

  const { name, email, builderId, phone, address } = requestBody;
  const lowerCaseEmail = email.toLowerCase();

  if(!checkValidEmail(lowerCaseEmail)) {
    return errorResponse(res, 400, "Invalid email");
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
    const builderQuery = `SELECT  * FROM builder WHERE builder_id = $1;`;
    const builderResult = await client.query(builderQuery, [builderId]);

    if (builderResult.rows.length === 0) {
      return errorResponse(res, 400, "Invalid builderId");
    }

    const isExistingContractorForSameBuilder = `SELECT email FROM contractor WHERE builder_id = $1;`;
    const isExistingContractorForSameBuilderResult = await client.query(isExistingContractorForSameBuilder, [builderId]);
    
    if (isExistingContractorForSameBuilderResult.rows.includes(lowerCaseEmail)) {
      return errorResponse(res, 400, "Contractor already exists for this builder");
    }

    const contractorQuery = `INSERT INTO contractor (name, email, builder_id, phone, address) VALUES ($1, $2, $3, $4, $5) RETURNING *;`;
    const contractorResult = await client.query(contractorQuery, [name, lowerCaseEmail, builderId, phone, address]);
    
    const result = contractorResult.rows[0];
    return successResponse(
      res,
      {
        ...result,
      },
      "Contractor created successfully."
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
