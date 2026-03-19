import getPool from "../../config/database.js";
import { keysToCamelCase } from "../../utils/common.js";

/**
 * USER REPOSITORY
 * Low-level DB operations only.
 * NO business logic here.
 */

/* ============================================================
        BASIC FINDERS
  ============================================================ */

export async function findByEmail(email) {
  const pool = getPool();
  const res = await pool.query(
    "SELECT * FROM users WHERE LOWER(email) = LOWER($1)",
    [email],
  );
  const user = res.rows[0];
  if (user) {
    return keysToCamelCase(user);
  }
  return null;
}

export async function findByLoginId(loginId) {
  const pool = getPool();
  const res = await pool.query("SELECT * FROM users WHERE login_id = $1", [
    loginId,
  ]);
  const user = res.rows[0];
  if (user) {
    return keysToCamelCase(user);
  }
  return null;
}

export async function getBasicUser(userId) {
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

export async function getUsers({ builderId, page, limit, search, role, role_id }) {
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

  const queryParams = [builderId, searchFilter];
  let paramIndex = 3;

  if (role) {
    whereClause += ` AND r.name = $${paramIndex++}`;
    queryParams.push(role);
  }

  if (role_id) {
    whereClause += ` AND u.role_id = $${paramIndex++}`;
    queryParams.push(role_id);
  }

  const res = await pool.query(
    `
      SELECT 
        u.users_id,
        u.name,
        u.email,
        u.login_id,
        u.role_id,
        r.name AS role_name,
        u.phone,
        u.secondary_phone,
        u.initials,
        u.reporting_to,
        ru.name AS reporting_to_name,
        u.designation,
        u.date_of_joining,
        u.date_of_birth,
        u.remark,
        u.consultant_bio,
        u.photo,
        u.signature,
        u.is_active,
        u.is_locked,
        u.is_verified,
        u.root_user,
        u.failed_attempts,
        u.next_login_password_change,
        u.password_auto_generated,
        u.email_login_credentials,
        u.address_id,
        u.use_company_address,
        u.has_login,
        jsonb_build_object(
          'address_id', a.address_id,
          'address_line1', a.address_line1,
          'address_line2', a.address_line2,
          'city', a.city,
          'state_id', a.state_id,
          'country_id', a.country_id,
          'zip_code', a.zip_code,
          'state_name', s.name,
          'country_name', c.name
        ) AS address,
        u.created_at,
        u.updated_at
      FROM users u
      LEFT JOIN role r ON r.role_id = u.role_id
      LEFT JOIN users ru ON ru.users_id = u.reporting_to
      LEFT JOIN address a ON a.address_id = u.address_id
      LEFT JOIN state s ON s.state_id = a.state_id
      LEFT JOIN country c ON c.country_id = a.country_id
      ${whereClause}
      ORDER BY u.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `,
    [...queryParams, limit, offset],
  );

  // Build count query with same filters
  const countWhereClause = whereClause.replace(
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
        GET ALL USERS (NO PAGINATION)
  ============================================================ */

export async function getAllUsers({ builderId, search, role, role_id, is_active }) {
  const pool = getPool();

  const searchFilter = search ? `%${search}%` : "%";

  let whereClause = `
    WHERE
      u.is_deleted = FALSE
      AND u.builder_id = $1
      AND (
        LOWER(u.name) LIKE LOWER($2)
        OR LOWER(u.email) LIKE LOWER($2)
        OR LOWER(u.login_id) LIKE LOWER($2)
        OR LOWER(u.phone) LIKE LOWER($2)
      )
  `;

  const queryParams = [builderId, searchFilter];
  let paramIndex = 3;

  if (role) {
    whereClause += ` AND r.name = $${paramIndex++}`;
    queryParams.push(role);
  }

  if (role_id) {
    whereClause += ` AND u.role_id = $${paramIndex++}`;
    queryParams.push(role_id);
  }

  if (is_active !== undefined) {
    whereClause += ` AND u.is_active = $${paramIndex++}`;
    queryParams.push(is_active);
  }

  console.log("🚀 ~ getAllUsers ~ whereClause:", whereClause);
  const res = await pool.query(
    `
      SELECT 
        u.users_id,
        u.name,
        u.email,
        u.login_id,
        u.role_id,
        r.name AS role_name,
        u.phone,
        u.secondary_phone,
        u.initials,
        u.reporting_to,
        ru.name AS reporting_to_name,
        u.designation,
        u.date_of_joining,
        u.date_of_birth,
        u.remark,
        u.consultant_bio,
        u.photo,
        u.signature,
        u.is_active,
        u.is_locked,
        u.is_verified,
        u.root_user,
        u.failed_attempts,
        u.next_login_password_change,
        u.password_auto_generated,
        u.email_login_credentials,
        u.address_id,
        u.use_company_address,
        u.has_login,
        jsonb_build_object(
          'address_id', a.address_id,
          'address_line1', a.address_line1,
          'address_line2', a.address_line2,
          'city', a.city,
          'state_id', a.state_id,
          'country_id', a.country_id,
          'zip_code', a.zip_code,
          'state_name', s.name,
          'country_name', c.name
        ) AS address,
        u.created_at,
        u.updated_at
      FROM users u
      LEFT JOIN role r ON r.role_id = u.role_id
      LEFT JOIN users ru ON ru.users_id = u.reporting_to
      LEFT JOIN address a ON a.address_id = u.address_id
      LEFT JOIN state s ON s.state_id = a.state_id
      LEFT JOIN country c ON c.country_id = a.country_id
      ${whereClause}
      ORDER BY u.created_at DESC
    `,
    queryParams,
  );
  console.log("🚀 ~ getAllUsers ~ res:", res);

  return res.rows.map((user) => keysToCamelCase(user));
}

/* ============================================================
        GET PROFILE (JOIN BUILDER + ADDRESS)
  ============================================================ */

export async function getProfile(userId) {
  const pool = getPool();
  const res = await pool.query(
    `
      SELECT 
        u.*,
        b.name AS builder_name,
        b.logo AS builder_logo,
        jsonb_build_object(
          'address_id', a.address_id,
          'address_line1', a.address_line1,
          'address_line2', a.address_line2,
          'city', a.city,
          'zip_code', a.zip_code,
          'country_id', a.country_id,
          'state_id', a.state_id
        ) AS address
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

export async function createUser(data) {
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
      is_verified,
      password_auto_generated,
    } = data;

    const res = await client.query(
      `
        INSERT INTO users (
          name, email, login_id, password, role_id,
          phone, secondary_phone, initials, reporting_to,
          date_of_joining, date_of_birth, designation, remark,
          consultant_bio, address_id, use_company_address,
          root_user, has_login, next_login_password_change, builder_id, is_verified, password_auto_generated
        )
        VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9,
          $10, $11, $12, $13,
          $14, $15, $16,
          $17, $18, $19, $20,
          $21, $22
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
        is_verified,
        password_auto_generated,
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

export async function updateUser(userId, data) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const keys = Object.keys(data).filter(
      (k) => data[k] !== undefined && k !== "builders",
    );

    if (keys.length === 0) {
      return;
    }

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

export async function softDeleteUser(userId) {
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

export async function updatePhoto(userId, url) {
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

export async function updateSignature(userId, url) {
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

export async function updatePassword(userId, encryptedPassword, askNextLogin) {
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
        UPDATE NEXT LOGIN PASSWORD CHANGE
  ============================================================ */

export async function updateNextLoginPasswordChange(userId, askNextLogin) {
  const pool = getPool();
  await pool.query(
    `
      UPDATE users
      SET next_login_password_change = $1,
          updated_at = NOW()
      WHERE users_id = $2
      `,
    [askNextLogin, userId],
  );
}

/* ============================================================
        CHANGE LOGIN ID
  ============================================================ */

export async function updateLoginId(userId, newLoginId) {
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

export async function updateActiveStatus(userId, isActive) {
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

export async function updateLockStatus(userId, isLocked) {
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

export async function getUserBuilder(userId) {
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

export async function setUserBuilder(userId, builderId) {
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

export default {
  createUser,
  updateUser,
  findByEmail,
  findByLoginId,
  getBasicUser,
  getProfile,
  getUsers,
  getAllUsers,
  updatePassword,
  updateNextLoginPasswordChange,
  updateLoginId,
  updateActiveStatus,
  updateLockStatus,
  softDeleteUser,
  updatePhoto,
  updateSignature,
  getUserBuilder,
  setUserBuilder,
};
