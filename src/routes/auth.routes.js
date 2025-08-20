const express = require("express");
const router = express.Router();
const { getUsersByBuilderId, registerUser, loginUser, getProfile, forgotPassword, resetPassword, refreshToken, logoutUser, inviteUser, getInvitedUser, acceptInvite } = require("../controllers/auth.controller");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const { validateRequest } = require("../middleware/validateRequestMiddleware");
const { createUserSchema, loginUserSchema, forgotPasswordSchema, resetPasswordSchema, refreshTokenSchema, inviteUserSchema, acceptInviteSchema, acceptInviteParamsSchema, getInvitedUserSchema } = require("../validations/auth.validation");
const { REQUEST_SOURCE } = require("../config/constants");

router.post("/register", validateRequest(createUserSchema), registerUser);
router.post("/login", validateRequest(loginUserSchema), loginUser);
router.post("/forgot-password", validateRequest(forgotPasswordSchema), forgotPassword);
router.post("/reset-password", validateRequest(resetPasswordSchema), resetPassword);
router.post("/refresh-token", validateRequest(refreshTokenSchema), refreshToken)

router.get("/users", authMiddleware, roleMiddleware, getUsersByBuilderId);
router.get("/profile", authMiddleware, getProfile);
router.get("/invited-user", validateRequest(getInvitedUserSchema, REQUEST_SOURCE.QUERY), authMiddleware, roleMiddleware, getInvitedUser)
router.post("/invite-user", validateRequest(inviteUserSchema), authMiddleware, roleMiddleware, inviteUser)
router.post("/accept-invite", validateRequest(acceptInviteSchema), validateRequest(acceptInviteParamsSchema, REQUEST_SOURCE.QUERY), acceptInvite)
router.post("/logout", authMiddleware, roleMiddleware, logoutUser)

module.exports = router;
