import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { env } from "../config/env.config.js";
import authService from "../modules/auth/auth.service.js";
import { errorResponse } from "../helper/response.js"; // Added here

const JWT_SECRET = env.JWT.JWT_SECRET;

const handleTokenAuthorization = async (requestId, token, req, res, next) => {
  try {
    console.info({ requestId, message: "🔄 Validating JWT token" });

    const payload = jwt.verify(token, JWT_SECRET);
    if (!payload?.userId) {
      console.warn({ requestId, message: "❌ Unauthorized: Invalid token" });
      return errorResponse(
        res,
        401,
        "Unauthorized: Invalid token or token not found",
      );
    }

    const userRecord = await authService.validateTokenAndUser(token, payload?.userId);

    if (!userRecord) {
      console.warn({ requestId, message: "❌ Unauthorized: Invalid token" });
      return errorResponse(
        res,
        401,
        "Unauthorized: Invalid token or token not found",
      );
    }

    req.user = userRecord;
    // Add aliases for consistency across controllers
    req.user.user_id = userRecord.users_id;
    req.user.id = userRecord.users_id;
    req.user.access_token = token;

    if (!req.user || !req.user.builder_id) {
      return errorResponse(
        res,
        401,
        "Unauthorized: Missing user or builder_id.",
      );
    }

    const builderId = req.user.builder_id;

    // ✅ Fetch company_id from DB if not already attached
    const company = await authService.getCompanyByBuilderId(builderId);

    const isCompanyExists = !!company;

    // ✅ Detect create-company API
    // adjust path/method if needed
    const isCreateCompanyRequest =
      (req.method === "GET" && req.originalUrl.includes("/company")) ||
      (req.method === "POST" && req.originalUrl.includes("/company")) ||
      (req.method === "GET" && req.originalUrl.includes("/timezone")) ||
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
    req.user.company_id = company.company_id;

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
        "Unauthorized: No Authorization header or API Key provided",
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
        "Unauthorized: Invalid authorization scheme or no token provided.",
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

export default authMiddleware;
