import getPool from "../config/database.js";

/**
 * Create or update address
 * If addressId = null → INSERT
 * Else → UPDATE
 */
export async function createOrUpdateAddress(addressId, data) {
  const pool = getPool();

  const { address_line1, address_line2, city, zip_code, country_id, state_id } =
    data;

  if (!addressId) {
    // CREATE COMPANY ADDRESS
    const res = await pool.query(
      `
        INSERT INTO address (
          address_line1, address_line2, city, zip_code,
          country_id, state_id
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING address_id
        `,
      [
        address_line1,
        address_line2 || null,
        city || null,
        zip_code || null,
        country_id || null,
        state_id || null,
      ],
    );

    return res.rows[0].address_id;
  }
  // UPDATE - only update fields that are provided
  const updateFields = [];
  const updateValues = [];
  let paramIndex = 1;

  if (address_line1 !== undefined) {
    updateFields.push(`address_line1 = $${paramIndex++}`);
    updateValues.push(address_line1);
  }
  if (address_line2 !== undefined) {
    updateFields.push(`address_line2 = $${paramIndex++}`);
    updateValues.push(address_line2);
  }
  if (city !== undefined) {
    updateFields.push(`city = $${paramIndex++}`);
    updateValues.push(city);
  }
  if (zip_code !== undefined) {
    updateFields.push(`zip_code = $${paramIndex++}`);
    updateValues.push(zip_code);
  }
  if (country_id !== undefined) {
    updateFields.push(`country_id = $${paramIndex++}`);
    updateValues.push(country_id);
  }
  if (state_id !== undefined) {
    updateFields.push(`state_id = $${paramIndex++}`);
    updateValues.push(state_id);
  }

  // Only proceed with update if there are fields to update
  if (updateFields.length > 0) {
    updateFields.push("updated_at = NOW()");
    updateValues.push(addressId);

    await pool.query(
      `
          UPDATE address
          SET
            ${updateFields.join(",\n            ")}
          WHERE address_id = $${paramIndex}
          `,
      updateValues,
    );
  }

  return addressId;

}

export default {
  createOrUpdateAddress,
};
