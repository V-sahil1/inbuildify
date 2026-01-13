const express = require("express");
const router = express.Router();
const {
  registerRoot,
  verifyEmail,
  resendOtp,
  login,
  forgotPassword,
  resetPassword,
  refreshToken,
  logout,
} = require("../controllers/auth.controller");
const {
  registerRootSchema,
  verifyEmailSchema,
  resendOtpSchema,
  loginUserSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  refreshTokenSchema,
} = require("../validations/auth.validation");
const { validateRequest } = require("../middleware/validateRequestMiddleware");
const authMiddleware = require("../middleware/authMiddleware");
const { REQUEST_SOURCE } = require("../config/constants");
const roleMiddleware = require("../middleware/roleMiddleware");
const camelToSnakeMiddleware = require("../middleware/caseConverterMiddleware")

// AUTH ROUTES
router.post(
  "/register", camelToSnakeMiddleware,
  validateRequest(registerRootSchema, REQUEST_SOURCE.BODY),
  registerRoot
);

router.post(
  "/verify-email", camelToSnakeMiddleware,
  validateRequest(verifyEmailSchema, REQUEST_SOURCE.BODY),
  verifyEmail
);

router.post(
  "/resend-otp", camelToSnakeMiddleware,
  validateRequest(resendOtpSchema, REQUEST_SOURCE.BODY),
  resendOtp
);

router.post(
  "/login", camelToSnakeMiddleware,
  validateRequest(loginUserSchema, REQUEST_SOURCE.BODY),
  login
);

router.post(
  "/forgot-password", camelToSnakeMiddleware,
  validateRequest(forgotPasswordSchema, REQUEST_SOURCE.BODY),
  forgotPassword
);

router.post(
  "/reset-password", 
  validateRequest(resetPasswordSchema, REQUEST_SOURCE.BODY),
  resetPassword
);

router.post(
  "/refresh-token",
  validateRequest(refreshTokenSchema, REQUEST_SOURCE.BODY),
  refreshToken
);

router.post("/logout", authMiddleware, roleMiddleware, logout);

module.exports = router;
