const express = require("express");
const router = express.Router();
const {
  getUsersByBuilderId,
  getProfile,
  getInvitedUser,
  inviteUser,
  acceptInvite,
  getAllUsers,
} = require("../controllers/user.controller");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const camelToSnakeMiddleware = require("../middleware/caseConverterMiddleware.js");

const { validateRequest } = require("../middleware/validateRequestMiddleware");
const {
  getInvitedUserSchema,
  inviteUserSchema,
  acceptInviteSchema,
  acceptInviteParamsSchema,
  getAllUserSchema,
} = require("../validations/user.validation");
const { REQUEST_SOURCE } = require("../config/constants");

router.get(
  "/",
  camelToSnakeMiddleware,
  validateRequest(getAllUserSchema, REQUEST_SOURCE.QUERY),
  authMiddleware,
  roleMiddleware,
  getAllUsers
);

router.get(
  "/users",
  camelToSnakeMiddleware,
  authMiddleware,
  roleMiddleware,
  getUsersByBuilderId
);
router.get("/profile", camelToSnakeMiddleware, authMiddleware, getProfile);
router.get(
  "/invited-user",
  camelToSnakeMiddleware,
  validateRequest(getInvitedUserSchema, REQUEST_SOURCE.QUERY),
  authMiddleware,
  roleMiddleware,
  getInvitedUser
);
router.post(
  "/invite-user",
  camelToSnakeMiddleware,
  validateRequest(inviteUserSchema),
  authMiddleware,
  roleMiddleware,
  inviteUser
);
router.post(
  "/accept-invite",
  camelToSnakeMiddleware,
  validateRequest(acceptInviteSchema),
  validateRequest(acceptInviteParamsSchema, REQUEST_SOURCE.QUERY),
  acceptInvite
);

module.exports = router;
