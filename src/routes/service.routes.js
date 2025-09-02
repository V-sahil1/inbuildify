const express = require("express");
const router = express.Router();
const { getServices } = require("../controllers/service.controller");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

router.use(authMiddleware);
router.use(roleMiddleware);

router.get("/", getServices);

module.exports = router;
