import getPool from "../../config/database";
import addressRepo from "../../repositories/address.repository";
import { keysToCamelCase } from "../../utils/common";

async function getCompanyByBuilderId(builderId, client) {
  const result = await client.query(
    `SELECT c.*, a.address_line1, a.address_line2, a.city, a.state_id, a.country_id, a.zip_code 
     FROM company c 
     LEFT JOIN address a ON c.address_id = a.address_id 
     WHERE c.builder_id = $1 LIMIT 1`,
    [builderId],
  );

  const company = result.rows[0] || null;

  if (!company) {
    return null;
  }

  if (company.timezone_id) {
    const tzResult = await client.query(
      "SELECT timezone_id, timezone_name FROM timezones WHERE timezone_id = $1",
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
  } else if (existingCompany?.addressId) {
    // Keep existing address if no new address provided
    addressId = existingCompany.addressId;
  }

  const mapTimezone = async (company) => {
    if (!company) {
      return null;
    }

    if (company.timezone_id) {
      const tzResult = await client.query(
        "SELECT timezone_id, timezone_name FROM timezones WHERE timezone_id = $1",
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

  // For update, preserve existing values for fields not provided in payload
  const updateQuery = `
    UPDATE company
    SET
      name = COALESCE($2, name),
      abn_number = COALESCE($3, abn_number),
      timezone_id = COALESCE($4, timezone_id),
      address_id = COALESCE($5, address_id),
      bank_name = COALESCE($6, bank_name),
      account_name = COALESCE($7, account_name),
      account_number = COALESCE($8, account_number),
      account_bsb = COALESCE($9, account_bsb),
      email_signature_logo = COALESCE($10, email_signature_logo),
      company_logo = COALESCE($11, company_logo),
      updated_at = NOW()
    WHERE builder_id = $1
    RETURNING *;
  `;

  const values = [
    builderId,
    payload.name !== undefined ? payload.name : null,
    payload.abn_number !== undefined ? payload.abn_number : null,
    payload.timezone_id !== undefined ? payload.timezone_id : null,
    addressId !== undefined ? addressId : null,
    payload.bank_name !== undefined ? payload.bank_name : null,
    payload.account_name !== undefined ? payload.account_name : null,
    payload.account_number !== undefined ? payload.account_number : null,
    payload.account_bsb !== undefined ? payload.account_bsb : null,
    payload.email_signature_logo !== undefined
      ? payload.email_signature_logo
      : null,
    payload.company_logo !== undefined ? payload.company_logo : null,
  ];

  const updateResult = await client.query(updateQuery, values);

  return mapTimezone(updateResult.rows[0]);
}

export default {
  getCompanyByBuilderId,

  upsertCompany,
};
