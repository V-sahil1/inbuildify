import express from "express";

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
} from "./auth.controller";
import {
  registerRootSchema,
  verifyEmailSchema,
  resendOtpSchema,
  loginUserSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  refreshTokenSchema,
} from "./auth.validation";
import { validateRequest } from "../../middleware/validateRequestMiddleware";
import authMiddleware from "../../middleware/authMiddleware";
import { REQUEST_SOURCE } from "../../config/constants";
import roleMiddleware from "../../middleware/roleMiddleware";
import camelToSnakeMiddleware from "../../middleware/caseConverterMiddleware";

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

export default router;
