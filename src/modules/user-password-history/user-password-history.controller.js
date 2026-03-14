const { successResponse, errorResponse } = require("../../helper/response");
const { keysToCamelCase, encrypt, decrypt } = require("../../utils/common");
const getPool = require("../../config/database");

exports.createUserPasswordHistory = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const userId = req.user?.user_id;
    const builderId = req.user?.builder_id;

    if (!userId) {
      return errorResponse(res, 400, "User ID not found in token.");
    }

    const { old_password } = req.body;

    if (!old_password) {
      return errorResponse(res, 400, "Old password is required.");
    }

    const encryptedPassword = encrypt(old_password);

    await client.query("BEGIN");

    const policyActive = await client.query(
      `SELECT password_history_count
       FROM password_policy
       WHERE builder_id = $1 AND is_active = true
       LIMIT 1`,
      [builderId]
    );

    if (policyActive.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "Password policy is inactive.");
    }

    const policyRes = await client.query(
      `SELECT password_history_count
       FROM password_policy
       WHERE builder_id = $1
       LIMIT 1`,
      [builderId]
    );

    if (policyRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 400, "Password policy not found for builder.");
    }

    const maxHistory = policyRes.rows[0].password_history_count;

    //  Get ONLY this user's password history
    const existingHistory = await client.query(
      `SELECT history_id, old_password
       FROM user_password_history
       WHERE user_id = $1
       ORDER BY changed_at ASC`,
      [userId]
    );

    // Prevent duplicate password for THIS user only
    const alreadyUsed = existingHistory.rows.find(
      (x) => x.old_password === encryptedPassword
    );

    if (alreadyUsed) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        400,
        "This password already exists in your password history."
      );
    }

    //  Auto-delete oldest passwords ONLY for THIS user
    if (existingHistory.rowCount >= maxHistory) {
      const deleteCount = existingHistory.rowCount - (maxHistory - 1);

      const oldestToDelete = existingHistory.rows
        .slice(0, deleteCount)
        .map((x) => x.history_id);

      await client.query(
        `DELETE FROM user_password_history
         WHERE user_id = $1
         AND history_id = ANY($2::uuid[])`,
        [userId, oldestToDelete]
      );
    }

    // Insert new password ONLY for this user
    const insertQuery = `
      INSERT INTO user_password_history (
        user_id,
        old_password
      )
      VALUES ($1, $2)
      RETURNING *;
    `;

    const result = await client.query(insertQuery, [userId, encryptedPassword]);

    await client.query("COMMIT");

    return successResponse(
      res,
      keysToCamelCase(result.rows[0]),
      "User password history saved successfully."
    );
  } catch (error) {
    await client.query("ROLLBACK");

    if (error.code === "23505") {
      return errorResponse(
        res,
        400,
        "This password already exists in your password history."
      );
    }

    console.error("Error saving user password history:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.getUserPasswordHistory = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const userId = req.user.user_id;

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const offset = (page - 1) * limit;

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM user_password_history
      WHERE user_id = $1;
    `;
    const countResult = await pool.query(countQuery, [userId]);
    const totalRecords = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(totalRecords / limit);

    const dataQuery = `
      SELECT *
      FROM user_password_history
      WHERE user_id = $1
      ORDER BY changed_at DESC
      LIMIT $2 OFFSET $3;
    `;
    const result = await pool.query(dataQuery, [userId, limit, offset]);

    //  Decrypt password before sending
    const history = result.rows.map((row) => ({
      ...row,
      old_password: decrypt(row.old_password),
    }));

    return res.json({
      status: true,
      message: "User password history fetched successfully",
      data: history,
      pagination: {
        total_records: totalRecords,
        current_page: page,
        total_pages: totalPages,
        limit,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error getting password history:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.deleteUserPasswordHistory = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const userId = req.user.user_id;

    if (!id) {
      return errorResponse(res, 400, "Histroy ID is required.");
    }
    const existingHistory = await client.query(
      `SELECT history_id FROM user_password_history WHERE history_id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (existingHistory.rowCount === 0) {
      return errorResponse(
        res,
        404,
        "User password history not found for this user."
      );
    }

    await client.query(
      `DELETE FROM user_password_history WHERE history_id = $1`,
      [id]
    );

    return successResponse(
      res,
      null,
      "User password history deleted successfully."
    );
  } catch (error) {
    console.error("Error deleting user password history:", error);
    return errorResponse(res, 500, error.message || "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.getUserPasswordHistoryById = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const userId = req.user?.user_id;

    if (!id) {
      return errorResponse(res, 400, "User password history id is required.");
    }

    const query = `
      SELECT *
      FROM user_password_history
      WHERE history_id = $1 AND user_id = $2
      LIMIT 1;
    `;

    const result = await client.query(query, [id, userId]);

    if (result.rowCount === 0) {
      return errorResponse(res, 404, "Password history not found.");
    }

    const history = result.rows[0];

    const decryptedHistory = {
      ...history,
      old_password: decrypt(history.old_password),
    };

    return successResponse(
      res,
      decryptedHistory,
      "User password history fetched successfully."
    );
  } catch (error) {
    console.error("Error fetching user password history:", error);
    return errorResponse(res, 500, "Internal Server Error");
  } finally {
    client.release();
  }
};

exports.deleteUserPasswordHistoryByUserId = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const loggedInUserId = req.user?.user_id;
    const { user_id } = req.params;

    if (!loggedInUserId) {
      return errorResponse(res, 401, "Unauthorized: User not logged in.");
    }

    if (user_id !== loggedInUserId) {
      return errorResponse(
        res,
        403,
        "You are not allowed to delete another user's password history."
      );
    }

    await client.query("BEGIN");

    const existing = await client.query(
      `
      SELECT history_id
      FROM user_password_history
      WHERE user_id = $1
      `,
      [user_id]
    );

    if (existing.rowCount === 0) {
      await client.query("ROLLBACK");
      return errorResponse(
        res,
        404,
        "No password history found for this user."
      );
    }

    const deleteQuery = `
      DELETE FROM user_password_history
      WHERE user_id = $1
      RETURNING history_id;
    `;

    const deleted = await client.query(deleteQuery, [user_id]);

    await client.query("COMMIT");

    return successResponse(
      res,
      {
        deletedCount: deleted.rowCount,
      },
      "User password history deleted successfully."
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error deleting user password history:", error);
    return errorResponse(res, 500, error?.message || "Internal Server Error");
  } finally {
    client.release();
  }
};
