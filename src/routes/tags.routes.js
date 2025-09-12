const express = require("express");
const router = express.Router();
const { getAllTags } = require("../controllers/tags.controller.js");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

router.use(authMiddleware);
router.use(roleMiddleware);

router.get("/", getAllTags);

module.exports = router;