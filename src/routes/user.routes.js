const express = require("express");
const router = express.Router();
const { getUsersByBuilderId, getProfile, getInvitedUser, inviteUser, acceptInvite } = require("../controllers/user.controller");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const { validateRequest } = require("../middleware/validateRequestMiddleware");
const { getInvitedUserSchema, inviteUserSchema, acceptInviteSchema, acceptInviteParamsSchema } = require("../validations/user.validation");
const { REQUEST_SOURCE } = require("../config/constants");

router.get("/users", authMiddleware, roleMiddleware, getUsersByBuilderId);
router.get("/profile", authMiddleware, getProfile);
router.get("/invited-user", validateRequest(getInvitedUserSchema, REQUEST_SOURCE.QUERY), authMiddleware, roleMiddleware, getInvitedUser)
router.post("/invite-user", validateRequest(inviteUserSchema), authMiddleware, roleMiddleware, inviteUser)
router.post("/accept-invite", validateRequest(acceptInviteSchema), validateRequest(acceptInviteParamsSchema, REQUEST_SOURCE.QUERY), acceptInvite)

module.exports = router;