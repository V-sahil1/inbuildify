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

    if (!req.user || !req.user.builder_id) {
      return errorResponse(
        res,
        401,
        "Unauthorized: Missing user or builder_id."
      );
    }

    const builderId = req.user.builder_id;

    // ✅ Fetch company_id from DB if not already attached
    const companyQuery = `
  SELECT company_id
  FROM company
  WHERE builder_id = $1
  LIMIT 1;
`;

    const results = await client.query(companyQuery, [builderId]);

    // 🚨 IMPORTANT: use results (not result)
    const isCompanyExists = results.rowCount > 0;

    // ✅ Detect create-company API
    // adjust path/method if needed
    const isCreateCompanyRequest =
      (req.method === "POST" && req.originalUrl.includes("/company")) ||
      (req.method === "POST" && req.originalUrl.includes("/address")) ||
      (req.method === "GET" && req.originalUrl.includes("/state")) ||
      (req.method === "GET" && req.originalUrl.includes("/country")) ||
      (req.method === "GET" && req.originalUrl.includes("/user/profile")) ||
      (req.method === "POST" && req.originalUrl.includes("/auth/logout"));

    // ❌ Company does not exist
    if (!isCompanyExists) {
      // ✅ Allow only create-company API
      if (isCreateCompanyRequest) {
        return next();
      }

      // ❌ Block all other APIs
      return errorResponse(res, 404, "Company not found for this builder.");
    }

    // ✅ Company exists → attach company_id
    req.user.company_id = results.rows[0].company_id;

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
