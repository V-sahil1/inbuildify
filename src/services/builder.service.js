const getPool = require("../config/database");
const { deleteFromS3 } = require("../utils/s3Upload");

async function insertAddress(client, address) {
  if (!address) return null;

  const result = await client.query(
    `
    INSERT INTO address (
      address_line1, address_line2, city, state_id, country_id, zip_code
    )
    VALUES ($1,$2,$3,$4,$5,$6)
    RETURNING address_id
    `,
    [
      address.address_line1,
      address.address_line2,
      address.city,
      address.state_id,
      address.country_id,
      address.zip_code,
    ]
  );

  return result.rows[0].address_id;
}

async function upsertBuilder(builderId, payload, logoUrl) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existing = await client.query(
      `SELECT * FROM builder WHERE builder_id = $1`,
      [builderId]
    );

    const addressId = payload.address
      ? await insertAddress(client, payload.address)
      : null;

    let builder;

    if (existing.rowCount === 0) {
      const result = await client.query(
        `
        INSERT INTO builder (
          builder_id, company_id, name, email, phone_number,
          abn_number, acn_number, hia_membership_no, registration_number,
          registered_building_practitioner, practitioner_reg_no,
          licensed_builder_name, address_id, logo
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
        RETURNING *
        `,
        [
          builderId,
          payload.company_id,
          payload.builder_name,
          payload.email,
          payload.phone_number,
          payload.abn_number,
          payload.acn_number,
          payload.hia_membership_no,
          payload.registration_number,
          payload.registered_building_practitioner,
          payload.practitioner_reg_no,
          payload.licensed_builder_name,
          addressId,
          logoUrl,
        ]
      );

      builder = result.rows[0];
    } else {
      const oldLogo = existing.rows[0].logo;

      const result = await client.query(
        `
        UPDATE builder
        SET
          name = $2,
          email = $3,
          phone_number = $4,
          abn_number = $5,
          acn_number = $6,
          hia_membership_no = $7,
          registration_number = $8,
          registered_building_practitioner = $9,
          practitioner_reg_no = $10,
          licensed_builder_name = $11,
          address_id = COALESCE($12, address_id),
          logo = COALESCE($13, logo),
          updated_at = NOW()
        WHERE builder_id = $1
        RETURNING *
        `,
        [
          builderId,
          payload.builder_name,
          payload.email,
          payload.phone_number,
          payload.abn_number,
          payload.acn_number,
          payload.hia_membership_no,
          payload.registration_number,
          payload.registered_building_practitioner,
          payload.practitioner_reg_no,
          payload.licensed_builder_name,
          addressId,
          logoUrl,
        ]
      );

      builder = result.rows[0];

      if (logoUrl && oldLogo && oldLogo !== logoUrl) {
        await deleteFromS3(oldLogo);
      }
    }

    if (payload.insurer) {
      await client.query(
        `
        INSERT INTO builder_insurer (
          builder_id, insurer_name, insured_name, phone_number,
          state_id, country_id, zip_code
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT (builder_id)
        DO UPDATE SET
          insurer_name = EXCLUDED.insurer_name,
          insured_name = EXCLUDED.insured_name,
          phone_number = EXCLUDED.phone_number,
          state_id = EXCLUDED.state_id,
          country_id = EXCLUDED.country_id,
          zip_code = EXCLUDED.zip_code,
          updated_at = NOW()
        `,
        [
          builderId,
          payload.insurer.insurer_name,
          payload.insurer.insured_name,
          payload.insurer.phone_number,
          payload.insurer.state_id,
          payload.insurer.country_id,
          payload.insurer.zip_code,
        ]
      );
    }

    await client.query("COMMIT");

    builder = await getBuilderProfile(builderId);
    return builder;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}


async function getBuilderProfile(builderId) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const result = await client.query(
      `
      SELECT
        b.*,
        jsonb_build_object(
          'address_id', a.address_id,
          'address_line1', a.address_line1,
          'address_line2', a.address_line2,
          'city', a.city,
          'state_id', a.state_id,
          'country_id', a.country_id,
          'zip_code', a.zip_code
        ) AS address,
        jsonb_build_object(
          'builder_insurer_id', bi.builder_insurer_id,
          'insurer_name', bi.insurer_name,
          'insured_name', bi.insured_name,
          'phone_number', bi.phone_number,
          'state_id', bi.state_id,
          'country_id', bi.country_id,
          'zip_code', bi.zip_code
        ) AS insurer
      FROM builder b
      LEFT JOIN address a ON a.address_id = b.address_id
      LEFT JOIN builder_insurer bi ON bi.builder_id = b.builder_id
      WHERE b.builder_id = $1
      LIMIT 1
      `,
      [builderId]
    );

    return result.rows[0] || null;
  } finally {
    client.release();
  }
}

module.exports = { upsertBuilder, getBuilderProfile };
