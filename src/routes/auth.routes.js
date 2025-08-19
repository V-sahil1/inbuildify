const express = require("express");
const router = express.Router();
const { createUser, loginUser, getProfile, forgotPassword, verifyOtp } = require("../controllers/user.controller");
const authMiddleware = require("../middleware/authMiddleware");
const { validateRequest } = require("../middleware/validateRequestMiddleware");
const { createUserSchema, loginUserSchema, forgotPasswordSchema, verifyOtpSchema } = require("../validations/auth.validation");

router.post("/register", validateRequest(createUserSchema), createUser);
router.post("/login", validateRequest(loginUserSchema), loginUser);
router.get("/profile", authMiddleware, getProfile);
router.post("/forgot-password", validateRequest(forgotPasswordSchema), forgotPassword);
router.post("/verify-otp", validateRequest(verifyOtpSchema), verifyOtp);
// router.post("/reset-password", resetPassword);
// router.get("/verify-email", verifyEmail);

module.exports = router;
