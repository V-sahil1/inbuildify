const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const { getUsersByBuilderId } = require("../controllers/user.controller");


router.use(authMiddleware);
router.use(roleMiddleware);

router.get("/", getUsersByBuilderId);
module.exports = router;
