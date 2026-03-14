const express = require("express");
const router = express.Router();
const { getDashboardData } = require("./dashboard.controller.js");
const authMiddleware = require("../../middleware/authMiddleware.js");
const roleMiddleware = require("../../middleware/roleMiddleware.js");

router.use(authMiddleware);
router.use(roleMiddleware);

router.get("/", getDashboardData);

module.exports = router;