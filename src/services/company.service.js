const getPool = require("../config/database");
const addressRepo = require("../repositories/address.repository");

const { keysToCamelCase } = require("../utils/common");

async function getCompanyByBuilderId(builderId, client) {
  const result = await client.query(
    `SELECT c.*, a.address_line1, a.address_line2, a.city, a.state_id, a.country_id, a.zip_code 
     FROM company c 
     LEFT JOIN address a ON c.address_id = a.address_id 
     WHERE c.builder_id = $1 LIMIT 1`,
    [builderId],
  );

  const company = result.rows[0] || null;

  if (!company) return null;

  if (company.timezone_id) {
    const tzResult = await client.query(
      `SELECT timezone_id, timezone_name FROM timezones WHERE timezone_id = $1`,
      [company.timezone_id],
    );

    company.timezone =
      tzResult.rowCount > 0
        ? [tzResult.rows[0].timezone_id, tzResult.rows[0].timezone_name]
        : null;
  } else {
    company.timezone = null;
  }

  // Create address object if address exists
  if (company.address_id) {
    company.address = {
      address_line1: company.address_line1,
      address_line2: company.address_line2,
      city: company.city,
      state_id: company.state_id,
      country_id: company.country_id,
      zip_code: company.zip_code,
    };
    // Remove individual address fields
    delete company.address_line1;
    delete company.address_line2;
    delete company.city;
    delete company.state_id;
    delete company.country_id;
    delete company.zip_code;
  }

  return keysToCamelCase(company);
}

async function upsertCompany(builderId, payload, client) {
  const existingCompany = await getCompanyByBuilderId(builderId, client);

  // Handle address object
  let addressId = null;
  if (payload.address) {
    addressId = await addressRepo.createOrUpdateAddress(
      existingCompany?.addressId || null,
      payload.address,
    );
  }

  const mapTimezone = async (company) => {
    if (!company) return null;

    if (company.timezone_id) {
      const tzResult = await client.query(
        `SELECT timezone_id, timezone_name FROM timezones WHERE timezone_id = $1`,

        [company.timezone_id],
      );

      company.timezone =
        tzResult.rowCount > 0
          ? [tzResult.rows[0].timezone_id, tzResult.rows[0].timezone_name]
          : null;
    } else {
      company.timezone = null;
    }

    return keysToCamelCase(company);
  };

  if (!existingCompany) {
    const insertQuery = `

      INSERT INTO company (

        builder_id,

        name,

        abn_number,

        timezone_id,

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

      payload.name,

      payload.abn_number,

      payload.timezone_id,

      addressId,

      payload.bank_name,

      payload.account_name,

      payload.account_number,

      payload.account_bsb,

      payload.email_signature_logo,

      payload.company_logo,
    ];

    const insertResult = await client.query(insertQuery, values);

    const company = insertResult.rows[0];

    // LINK COMPANY → BUILDER

    await client.query(
      `

    UPDATE builder

    SET company_id = $1, updated_at = NOW()

    WHERE builder_id = $2

    `,

      [company.company_id, builderId],
    );

    return mapTimezone(insertResult.rows[0]);
  }

  const updateQuery = `

    UPDATE company

    SET

      name = $2,

      abn_number = $3,

      timezone_id = $4,

      address_id = $5,

      bank_name = $6,

      account_name = $7,

      account_number = $8,

      account_bsb = $9,

      email_signature_logo = $10,

      company_logo = $11,

      updated_at = NOW()

    WHERE builder_id = $1

    RETURNING *;

  `;

  const values = [
    builderId,

    payload.name,

    payload.abn_number,

    payload.timezone_id,

    addressId,

    payload.bank_name,

    payload.account_name,

    payload.account_number,

    payload.account_bsb,

    payload.email_signature_logo,

    payload.company_logo,
  ];

  const updateResult = await client.query(updateQuery, values);

  return mapTimezone(updateResult.rows[0]);
}

module.exports = {
  getCompanyByBuilderId,

  upsertCompany,
};
