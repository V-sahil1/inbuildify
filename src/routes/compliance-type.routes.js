const express = require("express");
const router = express.Router();
const {
  getAllComplianceTypes,
} = require("../controllers/compliance-type.controller");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const camelToSnakeMiddleware = require("../middleware/caseConverterMiddleware.js");

router.use(authMiddleware);
router.use(roleMiddleware);
router.use(camelToSnakeMiddleware);

router.get("/", getAllComplianceTypes);

module.exports = router;