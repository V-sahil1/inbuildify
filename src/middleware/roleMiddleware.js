const errorResponse = require("../helper/response");
const { ERROR_MESSAGES, isValidRole } = require("../config/constants.js");
const isAuthorized = require("../helper/utils.js");
const getPool = require("../config/database");

const roleMiddleware = async (req, res, next) => {
  try {
    const role_id = req.user?.role_id;

    if (!role_id) {
      return errorResponse(res, 403, ERROR_MESSAGES.FORBIDDEN);
    }

    const pool = getPool();

    const { rowCount } = await pool.query(
      `
      SELECT 1
      FROM role
      WHERE role_id = $1
      `,
      [role_id]
    );

    if (rowCount === 0) {
      return errorResponse(res, 403, ERROR_MESSAGES.FORBIDDEN);
    }

    return next();
  } catch (err) {
    console.error("roleMiddleware error:", err);
    return errorResponse(res, 403, ERROR_MESSAGES.FORBIDDEN);
  }
};

module.exports = roleMiddleware;
