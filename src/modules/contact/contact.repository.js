const getPool = require("../../config/database");
const { keysToCamelCase } = require("../../utils/common");

/* ============================================================
        GET CONTACT LIST (pagination + search)
  ============================================================ */
async function getContacts({ builderId, search, is_active }) {
  const pool = getPool();
  let whereConditions = [];
  let queryParams = [];
  let paramIndex = 1;

  // Build WHERE conditions
  whereConditions.push(`u.builder_id = $${paramIndex++}`);
  queryParams.push(builderId);

  whereConditions.push(`u.is_deleted = FALSE`);

  whereConditions.push(`LOWER(r.name) = 'contact'`);

  if (search) {
    whereConditions.push(`(
      LOWER(u.name) LIKE $${paramIndex++} OR
      LOWER(u.email) LIKE $${paramIndex++} OR
      LOWER(u.phone) LIKE $${paramIndex++}
    )`);
    const searchTerm = `%${search.toLowerCase()}%`;
    queryParams.push(searchTerm, searchTerm, searchTerm);
  }

  if (is_active !== undefined) {
    whereConditions.push(`u.is_active = $${paramIndex++}`);
    queryParams.push(is_active);
  }

  const whereClause = whereConditions.join(" AND ");

  const rowsResult = await pool.query(
    `
      SELECT 
        u.users_id,
        u.name,
        u.email,
        u.phone,
        u.secondary_phone,
        u.remark,
        u.is_active,
        u.created_at,
        jsonb_build_object(
          'address_line1', a.address_line1,
          'address_line2', a.address_line2,
          'city', a.city,
          'zip_code', a.zip_code,
          'country_id', a.country_id,
          'state_id', a.state_id
        ) AS address
      FROM users u
      LEFT JOIN address a ON a.address_id = u.address_id
      LEFT JOIN role r ON r.role_id = u.role_id
      WHERE ${whereClause}
      ORDER BY u.created_at DESC
      `,
    [...queryParams],
  );

  return keysToCamelCase(rowsResult.rows);
}

/* ============================================================
        GET CONTACT BY ID
  ============================================================ */
async function getContactById(builderId, contact_id) {
  const pool = getPool();

  const result = await pool.query(
    `
      SELECT 
        u.users_id,
        u.name,
        u.email,
        u.phone,
        u.secondary_phone,
        u.remark,
        u.role_id,
        u.address_id,
        u.has_login,
        u.is_active,
        jsonb_build_object(
          'address_line1', a.address_line1,
          'address_line2', a.address_line2,
          'city', a.city,
          'zip_code', a.zip_code,
          'country_id', a.country_id,
          'state_id', a.state_id
        ) AS address
      FROM users u
      LEFT JOIN address a ON a.address_id = u.address_id
      LEFT JOIN role r ON r.role_id = u.role_id
      WHERE u.users_id = $1
        AND u.builder_id = $2
        AND u.is_deleted = FALSE
        AND LOWER(r.name) = 'contact'
      `,
    [contact_id, builderId],
  );

  return keysToCamelCase(result.rows[0]);
}

/* ============================================================
        CREATE CONTACT
  ============================================================ */
async function createContact(data) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const {
      name,
      email,
      phone,
      secondary_phone,
      remark,
      role_id,
      has_login,
      password,
      login_id,
      builder_id,
      address_id,
    } = data;

    const result = await client.query(
      `
        INSERT INTO users (
          name, email, phone, secondary_phone,
          remark, role_id, has_login, password,
          login_id, builder_id, address_id
        )
        VALUES (
          $1, $2, $3, $4,
          $5, $6, $7, $8,
          $9, $10, $11
        )
        RETURNING *
        `,
      [
        name,
        email,
        phone,
        secondary_phone,
        remark,
        role_id,
        has_login,
        password,
        login_id,
        builder_id,
        address_id,
      ],
    );

    await client.query("COMMIT");

    const contactResult = await pool.query(
      `
        SELECT 
          u.users_id,
          u.name,
          u.email,
          u.phone,
          u.secondary_phone,
          u.remark,
          u.role_id,
          u.address_id,
          u.has_login,
          u.is_active,
          u.created_at,
          jsonb_build_object(
            'address_line1', a.address_line1,
            'address_line2', a.address_line2,
            'city', a.city,
            'zip_code', a.zip_code,
            'country_id', a.country_id,
            'state_id', a.state_id
          ) AS address
        FROM users u
        LEFT JOIN address a ON a.address_id = u.address_id
        WHERE u.users_id = $1
          AND u.is_deleted = FALSE
          AND u.builder_id = $2
      `,
      [result.rows[0].users_id, builder_id],
    );

    return keysToCamelCase(contactResult.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/* ============================================================
        UPDATE CONTACT (dynamic update)
  ============================================================ */
async function updateContact(contactId, data) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const keys = Object.keys(data).filter((k) => data[k] !== undefined);

    if (keys.length === 0) return;

    let index = 1;
    const setClauses = keys.map((k) => `${k} = $${index++}`);
    const values = keys.map((k) => data[k]);

    await client.query(
      `
        UPDATE users
        SET ${setClauses.join(", ")}, updated_at = NOW()
        WHERE users_id = $${index}
        `,
      [...values, contactId],
    );

    const contactResult = await pool.query(
      `
        SELECT 
          u.users_id,
          u.name,
          u.email,
          u.phone,
          u.secondary_phone,
          u.remark,
          u.role_id,
          u.address_id,
          u.has_login,
          u.is_active,
          u.created_at,
          u.updated_at,
          jsonb_build_object(
            'address_line1', a.address_line1,
            'address_line2', a.address_line2,
            'city', a.city,
            'zip_code', a.zip_code,
            'country_id', a.country_id,
            'state_id', a.state_id
          ) AS address
        FROM users u
        LEFT JOIN address a ON a.address_id = u.address_id
        LEFT JOIN role r ON r.role_id = u.role_id
        WHERE u.users_id = $1
          AND u.is_deleted = FALSE
          AND LOWER(r.name) = 'contact'
      `,
      [contactId],
    );

    return keysToCamelCase(contactResult.rows[0]);
  } finally {
    client.release();
  }
}

/* ============================================================
        SOFT DELETE CONTACT
  ============================================================ */
async function softDeleteContact(contactId) {
  const pool = getPool();
  await pool.query(
    `
      UPDATE users
      SET is_deleted = TRUE, updated_at = NOW()
      WHERE users_id = $1
      `,
    [contactId],
  );
}

module.exports = {
  getContacts,
  getContactById,
  createContact,
  updateContact,
  softDeleteContact,
};
