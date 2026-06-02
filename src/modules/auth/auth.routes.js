import express from "express";
import passport from "passport";
import { env } from "../../config/env.config.js";

const router = express.Router();

import {
  registerRoot,
  verifyEmail,
  resendOtp,
  login,
  forgotPassword,
  resetPassword,
  refreshToken,
  logout,
  googleCallback,
} from "./auth.controller.js";
import {
  registerRootSchema,
  verifyEmailSchema,
  resendOtpSchema,
  loginUserSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  refreshTokenSchema,
} from "./auth.validation.js";
import { validateRequest } from "../../middleware/validateRequestMiddleware.js";
import authMiddleware from "../../middleware/authMiddleware.js";
import { REQUEST_SOURCE } from "../../config/constants.js";
import roleMiddleware from "../../middleware/roleMiddleware.js";
import camelToSnakeMiddleware from "../../middleware/caseConverterMiddleware.js";

// AUTH ROUTES
router.post(
  "/register", camelToSnakeMiddleware,
  validateRequest(registerRootSchema, REQUEST_SOURCE.BODY),
  registerRoot,
);

router.post(
  "/verify-email", camelToSnakeMiddleware,
  validateRequest(verifyEmailSchema, REQUEST_SOURCE.BODY),
  verifyEmail,
);

router.post(
  "/resend-otp", camelToSnakeMiddleware,
  validateRequest(resendOtpSchema, REQUEST_SOURCE.BODY),
  resendOtp,
);

router.post(
  "/login", camelToSnakeMiddleware,
  validateRequest(loginUserSchema, REQUEST_SOURCE.BODY),
  login,
);

router.post(
  "/forgot-password", camelToSnakeMiddleware,
  validateRequest(forgotPasswordSchema, REQUEST_SOURCE.BODY),
  forgotPassword,
);

router.post(
  "/reset-password",
  validateRequest(resetPasswordSchema, REQUEST_SOURCE.BODY),
  resetPassword,
);

router.post(
  "/refresh-token",
  validateRequest(refreshTokenSchema, REQUEST_SOURCE.BODY),
  refreshToken,
);

router.post("/logout", authMiddleware, roleMiddleware, logout);

// Google OAuth routes
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"], prompt: "select_account", session: false })
);

router.get(
  "/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: `${env.EMAIL.FRONTEND_BASE_URL}/auth/google-failure?error=Authentication%20failed`,
  }),
  googleCallback
);

export default router;
