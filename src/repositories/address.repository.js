const getPool = require("../config/database");

/**
 * Create or update address
 * If addressId = null → INSERT
 * Else → UPDATE
 */
async function createOrUpdateAddress(addressId, data) {
  const pool = getPool();

  const { address_line1, address_line2, city, zip_code, country_id, state_id } =
    data;

  if (!addressId) {
    // CREATE
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
      ]
    );

    return res.rows[0].address_id;
  } else {
    // UPDATE
    await pool.query(
      `
        UPDATE address
        SET
          address_line1 = $1,
          address_line2 = $2,
          city = $3,
          zip_code = $4,
          country_id = $5,
          state_id = $6,
          updated_at = NOW()
        WHERE address_id = $7
        `,
      [
        address_line1,
        address_line2 || null,
        city || null,
        zip_code || null,
        country_id || null,
        state_id || null,
        addressId,
      ]
    );

    return addressId;
  }
}

module.exports = {
  createOrUpdateAddress,
};
