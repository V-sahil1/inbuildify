const getPool = require("../config/database");
const { keysToCamelCase } = require("../utils/common");

async function getCompanyByBuilderId(builderId, client) {
  const result = await client.query(
    `SELECT * FROM company WHERE builder_id = $1 LIMIT 1`,
    [builderId]
  );

  const company = result.rows[0] || null;
  if (!company) return null;

  if (company.timezone_id) {
    const tzResult = await client.query(
      `SELECT timezone_id, timezone_name FROM timezones WHERE timezone_id = $1`,
      [company.timezone_id]
    );
    company.timezone =
      tzResult.rowCount > 0
        ? [tzResult.rows[0].timezone_id, tzResult.rows[0].timezone_name]
        : null;
  } else {
    company.timezone = null;
  }

  return keysToCamelCase(company);
}

async function upsertCompany(builderId, payload, client) {
  const existingCompany = await getCompanyByBuilderId(builderId, client);

  if (payload.country_id) {
    const countryCheck = await client.query(
      `SELECT country_id FROM country WHERE country_id = $1`,
      [payload.country_id]
    );

    if (countryCheck.rowCount === 0) {
      throw new Error("Invalid country_id.");
    }
  }

  if (payload.state_id) {
    const stateCheck = await client.query(
      `SELECT state_id FROM state WHERE state_id = $1`,
      [payload.state_id]
    );

    if (stateCheck.rowCount === 0) {
      throw new Error("Invalid state_id.");
    }
  }

  const mapTimezone = async (company) => {
    if (!company) return null;
    if (company.timezone_id) {
      const tzResult = await client.query(
        `SELECT timezone_id, timezone_name FROM timezones WHERE timezone_id = $1`,
        [company.timezone_id]
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
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
      RETURNING *;
    `;

    const values = [
      builderId,
      payload.name,
      payload.abn_number,
      payload.timezone_id,
      payload.address1,
      payload.address2,
      payload.city,
      payload.zip_postal_code,
      payload.state_id,
      payload.country_id,
      payload.bank_name,
      payload.account_name,
      payload.account_number,
      payload.account_bsb,
      payload.email_signature_logo,
      payload.company_logo,
    ];

    const insertResult = await client.query(insertQuery, values);
    return mapTimezone(insertResult.rows[0]);
  }

  const updateQuery = `
    UPDATE company
    SET
      name = $2,
      abn_number = $3,
      timezone_id = $4,
      address1 = $5,
      address2 = $6,
      city = $7,
      zip_postal_code = $8,
      state_id = $9,
      country_id = $10,
      bank_name = $11,
      account_name = $12,
      account_number = $13,
      account_bsb = $14,
      email_signature_logo = $15,
      company_logo = $16,
      updated_at = NOW()
    WHERE builder_id = $1
    RETURNING *;
  `;

  const values = [
    builderId,
    payload.name,
    payload.abn_number,
    payload.timezone_id,
    payload.address1,
    payload.address2,
    payload.city,
    payload.zip_postal_code,
    payload.state_id,
    payload.country_id,
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
