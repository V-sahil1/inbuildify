const { buildDynamicUpdate } = require("../utils/buildDynamicUpdate");
const { ADDRESS_UPDATE_FIELDS } = require("../constants/updateFields");

async function upsertAddress(client, existingAddressId, addressPayload) {
  if (!addressPayload) return null;

  // 🔹 INSERT (no existing address)
  if (!existingAddressId) {
    const result = await client.query(
      `
      INSERT INTO address (
        address_line1, address_line2, city, state_id, country_id, zip_code
      )
      VALUES ($1,$2,$3,$4,$5,$6)
      RETURNING address_id
      `,
      [
        addressPayload.address_line1,
        addressPayload.address_line2,
        addressPayload.city,
        addressPayload.state_id,
        addressPayload.country_id,
        addressPayload.zip_code,
      ]
    );

    return result.rows[0].address_id;
  }

  // 🔹 UPDATE (dynamic)
  const updateQuery = buildDynamicUpdate({
    table: "address",
    idColumn: "address_id",
    idValue: existingAddressId,
    payload: addressPayload,
    fieldMap: ADDRESS_UPDATE_FIELDS,
  });

  if (updateQuery) {
    await client.query(updateQuery.query, updateQuery.values);
  }

  return existingAddressId;
}

module.exports = { upsertAddress };
