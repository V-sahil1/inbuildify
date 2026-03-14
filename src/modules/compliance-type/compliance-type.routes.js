const express = require("express");
const router = express.Router();
const {
  getAllComplianceTypes,
} = require("./compliance-type.controller.js");
const authMiddleware = require("../../middleware/authMiddleware.js");
const roleMiddleware = require("../../middleware/roleMiddleware.js");
const camelToSnakeMiddleware = require("../../middleware/caseConverterMiddleware.js");

router.use(authMiddleware);
router.use(roleMiddleware);
router.use(camelToSnakeMiddleware);

router.get("/", getAllComplianceTypes);

module.exports = router;