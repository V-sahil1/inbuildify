import errorResponse from "../helper/response.js";
import { ERROR_MESSAGES, isValidRole } from "../config/constants.js";
import isAuthorized from "../helper/utils.js";
import getPool from "../config/database.js";

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
      [role_id],
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

export default roleMiddleware;
