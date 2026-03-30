import { buildDynamicUpdate } from "../../utils/buildDynamicUpdate.js";
import { ADDRESS_UPDATE_FIELDS } from "../../constants/updateFields.js";
import db from "../../config/database/models/postgre-models/index.js";
// export async function upsertAddress(client, existingAddressId, addressPayload) {
//   if (!addressPayload) {
//     return null;
//   }

//   // 🔹 INSERT (no existing address)
//   if (!existingAddressId) {
//     const result = await client.query(
//       `
//       INSERT INTO address (
//         address_line1, address_line2, city, state_id, country_id, zip_code
//       )
//       VALUES ($1,$2,$3,$4,$5,$6)
//       RETURNING address_id
//       `,
//       [
//         addressPayload.address_line1,
//         addressPayload.address_line2,
//         addressPayload.city,
//         addressPayload.state_id,
//         addressPayload.country_id,
//         addressPayload.zip_code,
//       ],
//     );

//     return result.rows[0].address_id;
//   }

//   // 🔹 UPDATE (dynamic)
//   const updateQuery = buildDynamicUpdate({
//     table: "address",
//     idColumn: "address_id",
//     idValue: existingAddressId,
//     payload: addressPayload,
//     fieldMap: ADDRESS_UPDATE_FIELDS,
//   });

//   if (updateQuery) {
//     await client.query(updateQuery.query, updateQuery.values);
//   }

//   return existingAddressId;
// }
// without transction
// export async function upsertAddress(existingAddressId, addressPayload) {
//   if (!addressPayload) return null;

//   // ── INSERT (no existing address) ────────────────────────────────────────────
//   if (!existingAddressId) {
//     const newAddress = await db.Address.create({
//       address_line1: addressPayload.address_line1,
//       address_line2: addressPayload.address_line2 || null,
//       city: addressPayload.city || null,
//       state_id: addressPayload.state_id || null,
//       country_id: addressPayload.country_id || null,
//       zip_code: addressPayload.zip_code || null,
//     });

//     return newAddress.address_id;
//   }

//   // ── UPDATE (only provided fields — dynamic) ─────────────────────────────────
//   const updatePayload = {};

//   for (const [payloadKey, columnName] of Object.entries(ADDRESS_UPDATE_FIELDS)) {
//     if (addressPayload[payloadKey] !== undefined) {
//       updatePayload[columnName] = addressPayload[payloadKey];
//     }
//   }

//   if (Object.keys(updatePayload).length > 0) {
//     await db.Address.update(updatePayload, {
//       where: { address_id: existingAddressId },
//     });
//   }

//   return existingAddressId;
// }

export async function upsertAddress(existingAddressId, addressPayload, t) {
  if (!addressPayload) return null;

  const { address_line1, address_line2, city, zip_code, country_id, state_id } = addressPayload;

  if (!existingAddressId) {
    // ── INSERT ────────────────────────────────────────────────────────────────
    const newAddress = await db.Address.create({
      address_line1,
      address_line2: address_line2 || null,
      city: city || null,
      zip_code: zip_code || null,
      country_id: country_id || null,
      state_id: state_id || null,
    }, { transaction: t });

    return newAddress.address_id;
  }

  // ── UPDATE (only provided fields) ─────────────────────────────────────────
  const updatePayload = {};

  for (const [payloadKey, columnName] of Object.entries(ADDRESS_UPDATE_FIELDS)) {
    if (addressPayload[payloadKey] !== undefined) {
      updatePayload[columnName] = addressPayload[payloadKey];
    }
  }

  if (Object.keys(updatePayload).length > 0) {
    await db.Address.update(updatePayload, {
      where: { address_id: existingAddressId },
      transaction: t,
    });
  }

  return existingAddressId;
}
export default { upsertAddress };
