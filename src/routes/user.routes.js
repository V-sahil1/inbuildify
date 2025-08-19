const express = require("express");
const router = express.Router();
const { createUser, loginUser, getProfile, verifyEmail, forgotPassword, verifyOtp, resetPassword } = require("../controllers/user.controller");
const authMiddleware = require("../middleware/authMiddleware.js");
const roleMiddleware = require("../middleware/roleMiddleware.js");

router.post("/register", createUser);
router.post("/login", loginUser);
router.get("/profile", authMiddleware, roleMiddleware, getProfile);
router.post("/forgot-password", forgotPassword);
router.post("/verify-otp", verifyOtp);
// router.post("/reset-password", resetPassword);
// router.get("/verify-email", verifyEmail);

module.exports = router;
