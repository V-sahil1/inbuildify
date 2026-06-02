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

    // The user must belong to either a Builder (regular tenant user) or a
    // Company directly (Company Administrator created via /company-signup).
    if (!req.user || (!req.user.builder_id && !req.user.company_id)) {
      return errorResponse(
        res,
        401,
        "Unauthorized: User is not linked to a company or builder.",
      );
    }

    // Resolve company_id — prefer the direct link on the user, fall back to
    // looking it up from the builder.
    let resolvedCompanyId = req.user.company_id || null;
    if (!resolvedCompanyId && req.user.builder_id) {
      const company = await authService.getCompanyByBuilderId(req.user.builder_id);
      if (company) resolvedCompanyId = company.company_id;
    }

    // ✅ Detect create-company API
    // adjust path/method if needed
    const isCreateCompanyRequest =
      (req.method === "GET" && req.originalUrl.includes("/company")) ||
      (req.method === "POST" && req.originalUrl.includes("/company")) ||
      // Phase 3 onboarding endpoints — must remain reachable while the
      // company is still being set up (no company row yet, or flag false).
      req.originalUrl.includes("/company-onboarding") ||
      (req.method === "GET" && req.originalUrl.includes("/timezone")) ||
      (req.method === "POST" && req.originalUrl.includes("/address")) ||
      (req.method === "GET" && req.originalUrl.includes("/state")) ||
      (req.method === "GET" && req.originalUrl.includes("/country")) ||
      (req.method === "GET" && req.originalUrl.includes("/user/profile")) ||
      (req.method === "POST" && req.originalUrl.includes("/auth/logout"));

    if (!resolvedCompanyId) {
      if (isCreateCompanyRequest) {
        return next();
      }
      return errorResponse(res, 404, "Company not found for this user.");
    }

    req.user.company_id = resolvedCompanyId;
    return next();
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
    if (scheme !== "Bearer" || !token || token === "undefined" || token === "null") {
      console.warn({
        requestId,
        message: "⚠️ Invalid authorization scheme or missing token",
      });
      return errorResponse(
        res,
        401,
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
