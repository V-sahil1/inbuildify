const getPool = require("../config/database");
const { keysToCamelCase } = require("../utils/common");

/**
 * USER REPOSITORY
 * Low-level DB operations only.
 * NO business logic here.
 */

/* ============================================================
        BASIC FINDERS
  ============================================================ */

async function findByEmail(email) {
  const pool = getPool();
  const res = await pool.query(
    `SELECT * FROM users WHERE LOWER(email) = LOWER($1)`,
    [email],
  );
  const user = res.rows[0];
  if (user) {
    return keysToCamelCase(user);
  }
  return null;
}

async function findByLoginId(loginId) {
  const pool = getPool();
  const res = await pool.query(`SELECT * FROM users WHERE login_id = $1`, [
    loginId,
  ]);
  const user = res.rows[0];
  if (user) {
    return keysToCamelCase(user);
  }
  return null;
}

async function getBasicUser(userId) {
  const pool = getPool();
  const res = await pool.query(
    `
      SELECT 
        users_id,
        builder_id,
        email,
        login_id,
        root_user,
        is_active,
        is_locked,
        photo,
        signature,
        address_id
      FROM users
      WHERE users_id = $1 AND is_deleted = FALSE
      `,
    [userId],
  );
  return keysToCamelCase(res.rows[0]);
}

/* ============================================================
        USER LISTING
  ============================================================ */

async function getUsers({ builderId, page, limit, search, role }) {
  const pool = getPool();
  const offset = (page - 1) * limit;

  const searchFilter = search ? `%${search}%` : "%";

  let whereClause = `
    WHERE
      u.is_deleted = FALSE
      AND u.builder_id = $1
      AND (
        LOWER(u.name) LIKE LOWER($2)
        OR LOWER(u.email) LIKE LOWER($2)
        OR LOWER(u.login_id) LIKE LOWER($2)
      )
  `;

  let queryParams = [builderId, searchFilter];
  let paramIndex = 3;

  // Add role filter if provided
  if (role) {
    whereClause += ` AND r.name = $${paramIndex++}`;
    queryParams.push(role);
  }

  const res = await pool.query(
    `
      SELECT 
        u.users_id,
        u.name,
        u.email,
        u.login_id,
        u.role_id,
        u.phone,
        u.secondary_phone,
        u.is_active,
        u.is_locked,
        u.created_at,
        u.updated_at,
        r.name AS role_name
      FROM users u
      LEFT JOIN role r ON r.role_id = u.role_id
      ${whereClause}
      ORDER BY u.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `,
    [...queryParams, limit, offset],
  );

  // Build count query with same filters
  let countWhereClause = whereClause.replace(
    `LIMIT $${paramIndex - 2} OFFSET $${paramIndex - 1}`,
    "",
  );

  const countRes = await pool.query(
    `
      SELECT COUNT(*)::int
      FROM users u
      LEFT JOIN role r ON r.role_id = u.role_id
      ${countWhereClause}
    `,
    queryParams,
  );

  return {
    users: res.rows.map((user) => keysToCamelCase(user)),
    total: countRes.rows[0].count,
  };
}

/* ============================================================
        GET PROFILE (JOIN BUILDER + ADDRESS)
  ============================================================ */

async function getProfile(userId) {
  const pool = getPool();
  const res = await pool.query(
    `
      SELECT 
        u.*,
        b.name AS builder_name,
        b.logo AS builder_logo,
        a.address_line1,
        a.address_line2,
        a.city,
        a.zip_code,
        a.country_id,
        a.state_id
      FROM users u
      LEFT JOIN builder b ON b.builder_id = u.builder_id
      LEFT JOIN address a ON a.address_id = u.address_id
      WHERE u.users_id = $1 AND u.is_deleted = FALSE
      `,
    [userId],
  );
  return keysToCamelCase(res.rows[0]);
}

/* ============================================================
        CREATE USER
  ============================================================ */

async function createUser(data) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const {
      name,
      email,
      login_id,
      password,
      role_id,
      phone,
      secondary_phone,
      initials,
      reporting_to,
      date_of_joining,
      date_of_birth,
      designation,
      remark,
      consultant_bio,
      address_id,
      use_company_address,
      root_user,
      has_login,
      next_login_password_change,
      builder_id,
    } = data;

    const res = await client.query(
      `
        INSERT INTO users (
          name, email, login_id, password, role_id,
          phone, secondary_phone, initials, reporting_to,
          date_of_joining, date_of_birth, designation, remark,
          consultant_bio, address_id, use_company_address,
          root_user, has_login, next_login_password_change, builder_id, is_verified
        )
        VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9,
          $10, $11, $12, $13,
          $14, $15, $16,
          $17, $18, $19, $20, true
        )
        RETURNING *
        `,
      [
        name,
        email,
        login_id,
        password,
        role_id,
        phone,
        secondary_phone,
        initials,
        reporting_to,
        date_of_joining,
        date_of_birth,
        designation,
        remark,
        consultant_bio,
        address_id,
        use_company_address,
        root_user,
        has_login,
        next_login_password_change,
        builder_id,
      ],
    );

    await client.query("COMMIT");
    return keysToCamelCase(res.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/* ============================================================
        UPDATE USER (DYNAMIC UPDATE BUILDER)
  ============================================================ */

async function updateUser(userId, data) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const keys = Object.keys(data).filter(
      (k) => data[k] !== undefined && k !== "builders",
    );

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
      [...values, userId],
    );
  } finally {
    client.release();
  }
}

/* ============================================================
        SOFT DELETE USER
  ============================================================ */

async function softDeleteUser(userId) {
  const pool = getPool();
  await pool.query(
    `
      UPDATE users
      SET is_deleted = TRUE, updated_at = NOW()
      WHERE users_id = $1
      `,
    [userId],
  );
}

/* ============================================================
        PHOTO & SIGNATURE
  ============================================================ */

async function updatePhoto(userId, url) {
  const pool = getPool();
  await pool.query(
    `
      UPDATE users
      SET photo = $1, updated_at = NOW()
      WHERE users_id = $2
      `,
    [url, userId],
  );
}

async function updateSignature(userId, url) {
  const pool = getPool();
  await pool.query(
    `
      UPDATE users
      SET signature = $1, updated_at = NOW()
      WHERE users_id = $2
      `,
    [url, userId],
  );
}

/* ============================================================
        PASSWORD RESET
  ============================================================ */

async function updatePassword(userId, encryptedPassword, askNextLogin) {
  const pool = getPool();
  await pool.query(
    `
      UPDATE users
      SET password = $1,
          next_login_password_change = $2,
          updated_at = NOW()
      WHERE users_id = $3
      `,
    [encryptedPassword, askNextLogin, userId],
  );
}

/* ============================================================
        CHANGE LOGIN ID
  ============================================================ */

async function updateLoginId(userId, newLoginId) {
  const pool = getPool();
  await pool.query(
    `
      UPDATE users
      SET login_id = $1, updated_at = NOW()
      WHERE users_id = $2
      `,
    [newLoginId, userId],
  );
}

/* ============================================================
        ACTIVE / LOCK STATUS
  ============================================================ */

async function updateActiveStatus(userId, isActive) {
  const pool = getPool();
  await pool.query(
    `
      UPDATE users
      SET is_active = $1, updated_at = NOW()
      WHERE users_id = $2
      `,
    [isActive, userId],
  );
}

async function updateLockStatus(userId, isLocked) {
  const pool = getPool();
  await pool.query(
    `
      UPDATE users
      SET is_locked = $1, updated_at = NOW()
      WHERE users_id = $2
      `,
    [isLocked, userId],
  );
}

/* ============================================================
    BUILDER MANAGEMENT
============================================================ */

async function getUserBuilder(userId) {
  const pool = getPool();
  const res = await pool.query(
    `
      SELECT builder_id
      FROM users
      WHERE users_id = $1 AND is_deleted = FALSE
      `,
    [userId],
  );
  return res.rows[0] || null;
}

async function setUserBuilder(userId, builderId) {
  const pool = getPool();
  await pool.query(
    `
      UPDATE users
      SET builder_id = $1, updated_at = NOW()
      WHERE users_id = $2
      `,
    [builderId, userId],
  );
}

module.exports = {
  createUser,
  updateUser,
  findByEmail,
  findByLoginId,
  getBasicUser,
  getProfile,
  getUsers,
  updatePassword,
  updateLoginId,
  updateActiveStatus,
  updateLockStatus,
  softDeleteUser,
  updatePhoto,
  updateSignature,
  getUserBuilder,
  setUserBuilder,
};
