const getPool = require("../config/database");
const { successResponse, errorResponse } = require("../helper/response");
const { keysToCamelCase } = require("../utils/common");

// exports.createCompany = async (req, res) => {
//   const pool = getPool();
//   const client = await pool.connect();
//   const builderId = req.user?.builder_id;

//   try {
//     const {
//       name,
//       abn_number,
//       timezone,
//       address_id,
//       bank_name,
//       account_name,
//       account_number,
//       account_bsb,
//     } = req.body;

//     const emailSignatureLogoImage = req.body.emailSignatureLogoImage || null;
//     const companyLogoImage = req.body.companyLogoImage || null;

//     if (!builderId) {
//       return errorResponse(res, 401, "Unauthorized: Missing builder ID.");
//     }

//     if (!name) {
//       return errorResponse(res, 400, "Company name is required.");
//     }

//     if (address_id) {
//       const addressCheck = await client.query(
//         `SELECT address_id FROM address WHERE address_id = $1 LIMIT 1`,
//         [address_id]
//       );

//       if (addressCheck.rowCount === 0) {
//         await client.query("ROLLBACK");
//         return errorResponse(
//           res,
//           400,
//           "Invalid address_id. Address not found."
//         );
//       }
//     }

//     await client.query("BEGIN");

//     // Optional: prevent multiple companies per builder
//     const existing = await client.query(
//       `SELECT company_id FROM company WHERE builder_id = $1`,
//       [builderId]
//     );

//     if (existing.rows.length > 0) {
//       await client.query("ROLLBACK");
//       return errorResponse(
//         res,
//         400,
//         "A company already exists for this builder."
//       );
//     }

//     const insertQuery = `
//       INSERT INTO company (
//         builder_id,
//         name,
//         abn_number,
//         timezone,
//         address_id,
//         bank_name,
//         account_name,
//         account_number,
//         account_bsb,
//         email_signature_logo,
//         company_logo
//       )
//       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
//       RETURNING *;
//     `;

//     const values = [
//       builderId,
//       name,
//       abn_number || null,
//       timezone || null,
//       address_id || null,
//       bank_name || null,
//       account_name || null,
//       account_number || null,
//       account_bsb || null,
//       emailSignatureLogoImage || null,
//       companyLogoImage || null,
//     ];

//     const result = await client.query(insertQuery, values);

//     await client.query("COMMIT");

//     return successResponse(
//       res,
//       keysToCamelCase(result.rows[0]),
//       "Company created successfully."
//     );
//   } catch (err) {
//     await client.query("ROLLBACK");
//     console.error("Error creating company:", err);
//     return errorResponse(res, 500, err.message || "Internal Server Error");
//   } finally {
//     client.release();
//   }
// };

exports.createCompany = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();
  const builderId = req.user?.builder_id;

  try {
    const {
      name,
      abn_number,
      timezone_id,
      address1,
      address2,
      city,
      zip_postal_code,
      state_id,
      country_id,
      bank_name,
      account_name,
      account_number,
      account_bsb,
    } = req.body;

    const emailSignatureLogoImage = req.body.email_signature_logo || null;
    const companyLogoImage = req.body.company_logo || null;

    if (!builderId) {
      return errorResponse(res, 401, "Unauthorized: Missing builder ID.");
    }

    if (!name) {
      return errorResponse(res, 400, "Company name is required.");
    }

    if (!timezone_id) {
      return errorResponse(res, 400, "Timezone ID is required.");
    }

    if (!address1 || !city || !zip_postal_code) {
      return errorResponse(
        res,
        400,
        "Address1, city, and zip/postal code are required."
      );
    }

    await client.query("BEGIN");

    /* 1️⃣ One builder → one company */
    const existingCompany = await client.query(
      `SELECT company_id FROM company WHERE builder_id = $1 LIMIT 1`,
      [builderId]
    );

    if (existingCompany.rowCount > 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "This builder already has a company.");
    }

    /* 2️⃣ Validate timezone_id */
    const timezoneCheck = await client.query(
      `SELECT timezone_id FROM timezones WHERE timezone_id = $1`,
      [timezone_id]
    );

    if (timezoneCheck.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "Invalid timezone_id.");
    }

    /* 3️⃣ Validate state_id (optional) */
    if (state_id) {
      const stateCheck = await client.query(
        `SELECT state_id FROM state WHERE state_id = $1`,
        [state_id]
      );

      if (stateCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Invalid state_id.");
      }
    }

    /* 4️⃣ Validate country_id (optional) */
    if (country_id) {
      const countryCheck = await client.query(
        `SELECT country_id FROM country WHERE country_id = $1`,
        [country_id]
      );

      if (countryCheck.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, 400, "Invalid country_id.");
      }
    }

    const insertQuery = `
      INSERT INTO company (
        builder_id,
        name,
        abn_number,
        timezone_id,
        address1,
        address2,
        city,
        zip_postal_code,
        state_id,
        country_id,
        bank_name,
        account_name,
        account_number,
        account_bsb,
        email_signature_logo,
        company_logo
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16
      )
      RETURNING *;
    `;

    const values = [
      builderId,
      name,
      abn_number || null,
      timezone_id,
      address1,
      address2 || null,
      city,
      zip_postal_code,
      state_id || null,
      country_id || null,
      bank_name || null,
      account_name || null,
      account_number || null,
      account_bsb || null,
      emailSignatureLogoImage,
      companyLogoImage,
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
