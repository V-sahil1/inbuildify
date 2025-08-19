const express = require("express");
const router = express.Router();
const { registerUser, loginUser, getProfile } = require("../controllers/user.controller");
const authMiddleware = require("../middleware/authMiddleware");
const { validateRequest } = require("../middleware/validateRequestMiddleware");
const { createUserSchema, loginUserSchema } = require("../validations/auth.validation");

router.post("/register", validateRequest(createUserSchema), registerUser);
router.post("/login", validateRequest(loginUserSchema), loginUser);
router.get("/profile", authMiddleware, getProfile);

module.exports = router;
