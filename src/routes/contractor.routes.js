const express = require("express");
const router = express.Router();
const {
  createContractor,
} = require("../controllers/contractor.controller");
const authMiddleware = require("../middleware/authMiddleware.js");
const roleMiddleware = require("../middleware/roleMiddleware.js");

router.post("/", authMiddleware,roleMiddleware, createContractor);

module.exports = router;
