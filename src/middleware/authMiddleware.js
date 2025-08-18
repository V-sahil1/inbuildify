const jwt = require("jsonwebtoken");
const getPool = require("../config/database");
const { v4: uuidv4 } = require("uuid");
const { errorResponse } = require("../helper/response");
const dotenv = require("dotenv");
dotenv.config({ quiet: true });

const handleTokenAuthorization = async (requestId, token, req, res, next) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    console.info({ requestId, message: "🔄 Validating JWT token" });

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (!payload?.userId) {
      console.warn({ requestId, message: "❌ Unauthorized: Invalid token" });
      return errorResponse(
        res,
        401,
        "Unauthorized: Invalid token or token not found"
      );
    }

    const query = `
      SELECT *
      FROM users u
      INNER JOIN users_token ut ON u.users_id = ut.user_id
      WHERE ut.access_token = $1 
        AND u.users_id = $2 
        AND u.is_verified = $3;
    `;
    const result = await client.query(query, [token, payload?.userId, true]);

    if (result?.rows?.length === 0) {
      console.warn({ requestId, message: "❌ Unauthorized: Invalid token" });
      return errorResponse(
        res,
        401,
        "Unauthorized: Invalid token or token not found"
      );
    }

    req.user = result.rows[0];

    console.info({ requestId, message: "✅ JWT authentication successful" });
    next();
  } catch (error) {
    console.error({
      requestId,
      message: `⚠️ Authentication error: ${error.message}`,
    });

    if (error.name === "TokenExpiredError") {
      return errorResponse(res, 401, "Unauthorized: Your token has expired");
    }
    return errorResponse(res, 401, `Unauthorized: ${error.message}`);
  } finally {
    client.release();
  }
};

const authMiddleware = (req, res, next) => {
  const requestId = uuidv4();
  console.info({
    requestId,
    Endpoint: req.path,
    RequestLog: JSON.stringify(req.headers),
  });

  try {
    const authorizationHeader = req.headers.authorization || "";

    if (!authorizationHeader) {
      console.warn({
        requestId,
        message: "❌ Unauthorized: No Authorization header or API Key provided",
      });
      return errorResponse(
        res,
        401,
        "Unauthorized: No Authorization header or API Key provided"
      );
    }

    const [scheme, token] = authorizationHeader.split(" ");
    if (scheme !== "Bearer" || !token) {
      console.warn({
        requestId,
        message: "⚠️ Invalid authorization scheme or missing token",
      });
      return errorResponse(
        res,
        400,
        "Unauthorized: Invalid authorization scheme or no token provided."
      );
    }
    return handleTokenAuthorization(requestId, token, req, res, next);
  } catch (error) {
    console.error({
      requestId,
      message: `💥 Middleware error: ${error.message}`,
    });
    const message =
      error.name === "TokenExpiredError"
        ? "Unauthorized: Your token has expired"
        : `Unauthorized: ${error.message}`;
    return errorResponse(res, 401, message);
  }
};

module.exports = authMiddleware;
