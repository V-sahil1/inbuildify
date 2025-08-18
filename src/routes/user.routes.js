const express = require("express");
const router = express.Router();
const { createUser, loginUser, getProfile } = require("../controllers/user.controller");
const authMiddleware = require("../middleware/authMiddleware.js");

router.post("/register", createUser);
router.post("/login", loginUser);
router.get("/profile", authMiddleware, getProfile);

module.exports = router;
