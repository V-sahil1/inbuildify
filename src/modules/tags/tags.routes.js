const express = require("express");
const router = express.Router();
const { getAllTags } = require("./tags.controller.js");
const authMiddleware = require("../../middleware/authMiddleware.js");
const roleMiddleware = require("../../middleware/roleMiddleware.js");

router.use(authMiddleware);
router.use(roleMiddleware);

router.get("/", getAllTags);

module.exports = router;