const getPool = require("../config/database");
const { successResponse, errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

exports.createCompany = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();
  const builderId = req.user?.builder_id;

  try {
    const {
      name,
      abn_number,
      timezone,
      address_id,
      bank_name,
      account_name,
      account_number,
      account_bsb,
    } = req.body;

    const emailSignatureLogoImage = req.body.emailSignatureLogoImage || null;
    const companyLogoImage = req.body.companyLogoImage || null;

    if (!builderId) {
      return errorResponse(res, 401, "Unauthorized: Missing builder ID.");
    }

    if (!name) {
      return errorResponse(res, 400, "Company name is required.");
    }

    await client.query("BEGIN");

    // Optional: prevent multiple companies per builder
    const existing = await client.query(
      `SELECT company_id FROM company WHERE builder_id = $1`,
      [builderId]
    );

    if (existing.rows.length > 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "A company already exists for this builder."
      );
    }

    const insertQuery = `
      INSERT INTO company (
        builder_id,
        name,
        abn_number,
        timezone,
        address_id,
        bank_name,
        account_name,
        account_number,
        account_bsb,
        email_signature_logo,
        company_logo
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING *;
    `;

    const values = [
      builderId,
      name,
      abn_number || null,
      timezone || null,
      address_id || null,
      bank_name || null,
      account_name || null,
      account_number || null,
      account_bsb || null,
      emailSignatureLogoImage || null,
      companyLogoImage || null,
    ];

    const result = await client.query(insertQuery, values);

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "Company created successfully."
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error creating company:", err);
    return errorResponse(res, 500, err.message || "Internal Server Error");
  } finally {
    client.release();
  }
};
