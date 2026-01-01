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
} = require("../validations/auth.validation");

router.post(
  "/register",
  camelToSnakeMiddleware,
  validateRequest(createUserSchema),
  registerUser
);
router.post(
  "/verify-emailOtp",
  validateRequest(verifyEmailSchema),
  verifyEmailOtp
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
