import { buildDynamicUpdate } from "../../utils/buildDynamicUpdate.js";
import { ADDRESS_UPDATE_FIELDS } from "../../constants/updateFields.js";
import db from "../../config/database/models/postgre-models/index.js";

export async function upsertAddress(existingAddressId, addressPayload, t) {
  if (!addressPayload) {
    return null;
  }

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
