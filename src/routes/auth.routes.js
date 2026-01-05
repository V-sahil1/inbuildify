const express = require("express");
const router = express.Router();
const {
  registerUser,
  verifyEmailOtp,
  loginUser,
  forgotPassword,
  resetPassword,
  refreshToken,
  logoutUser,
  resendOtp,
} = require("../controllers/auth.controller");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const camelToSnakeMiddleware = require("../middleware/caseConverterMiddleware.js");

const { validateRequest } = require("../middleware/validateRequestMiddleware");
const {
  createUserSchema,
  verifyEmailSchema,
  loginUserSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  refreshTokenSchema,
  resendOtpSchema,
} = require("../validations/auth.validation");

router.post(
  "/register",
  camelToSnakeMiddleware,
  validateRequest(createUserSchema),
  registerUser
);
router.post(
  "/verify-email",
  validateRequest(verifyEmailSchema),
  verifyEmailOtp
);
router.post(
  "/resend-otp",
  validateRequest(resendOtpSchema),
  resendOtp
);
router.post("/login", validateRequest(loginUserSchema), loginUser);
router.post(
  "/forgot-password",
  validateRequest(forgotPasswordSchema),
  forgotPassword
);
router.post(
  "/reset-password",
  validateRequest(resetPasswordSchema),
  resetPassword
);
router.post(
  "/refresh-token",
  validateRequest(refreshTokenSchema),
  refreshToken
);

router.post("/logout", authMiddleware, roleMiddleware, logoutUser);

module.exports = router;
