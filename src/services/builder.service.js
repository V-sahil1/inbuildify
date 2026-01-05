const getPool = require("../config/database");
const { deleteFromS3 } = require("../utils/s3Upload");
const { buildDynamicUpdate } = require("../utils/buildDynamicUpdate");
const { BUILDER_UPDATE_FIELDS } = require("../constants/updateFields");
const { upsertAddress } = require("./address.service");

async function upsertBuilder(builderId, payload, logoUrl) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existingRes = await client.query(
      `SELECT * FROM builder WHERE builder_id = $1`,
      [builderId]
    );

    const exists = existingRes.rowCount > 0;
    const oldLogo = exists ? existingRes.rows[0].logo : null;
    const existingAddressId = exists ? existingRes.rows[0].address_id : null;

    // 🔹 Address handling
    const addressId = payload.address
      ? await upsertAddress(client, existingAddressId, payload.address)
      : undefined;

    if (!exists) {
      // CREATE
      await client.query(
        `
        INSERT INTO builder (
          builder_id, company_id, name, email, phone_number,
          abn_number, acn_number, hia_membership_no, registration_number,
          registered_building_practitioner, practitioner_reg_no,
          licensed_builder_name, address_id, logo
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
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
          addressId || null,
          logoUrl || null,
        ]
      );
    } else {
      // UPDATE (DYNAMIC)
      const updatePayload = {
        ...payload,
        ...(addressId && { address_id: addressId }),
        ...(logoUrl && { logo: logoUrl }),
      };

      const updateQuery = buildDynamicUpdate({
        table: "builder",
        idColumn: "builder_id",
        idValue: builderId,
        payload: updatePayload,
        fieldMap: BUILDER_UPDATE_FIELDS,
      });

      if (updateQuery) {
        await client.query(updateQuery.query, updateQuery.values);
      }

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
