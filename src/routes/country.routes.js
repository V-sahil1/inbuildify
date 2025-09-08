const express = require("express");
const router = express.Router();
const { getCountries } = require("../controllers/country.controller");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

router.use(authMiddleware);
router.use(roleMiddleware);

router.get("/", getCountries);

module.exports = router;