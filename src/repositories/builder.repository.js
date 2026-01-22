const getPool = require("../config/database");

async function getBuilderAddress(builderId) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const result = await client.query(
      `
      SELECT 
        a.address_id,
        a.address_line1,
        a.address_line2,
        a.city,
        a.state_id,
        a.country_id,
        a.zip_code,
        a.created_at,
        a.updated_at
      FROM builder b
      LEFT JOIN address a ON a.address_id = b.address_id
      WHERE b.builder_id = $1
      LIMIT 1
      `,
      [builderId],
    );

    return result.rows[0] || null;
  } finally {
    client.release();
  }
}

module.exports = {
  getBuilderAddress,
};
