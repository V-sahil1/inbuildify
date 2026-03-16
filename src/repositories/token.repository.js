import getPool from "../config/database";

// Insert token pair
async function saveTokens(userId, accessToken, refreshToken) {
  const pool = getPool();
  await pool.query(
    `
      INSERT INTO users_token (user_id, access_token, refresh_token)
      VALUES ($1, $2, $3)
      `,
    [userId, accessToken, refreshToken],
  );
}

// Invalidate all tokens for a user (on lock)
async function invalidateUserSessions(userId) {
  const pool = getPool();
  await pool.query("DELETE FROM users_token WHERE user_id = $1", [userId]);
}

export default {
  saveTokens,
  invalidateUserSessions,
};
