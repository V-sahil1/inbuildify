const express = require("express");
const router = express.Router();

const authMiddleware = require("../../middleware/authMiddleware");
const roleMiddleware = require("../../middleware/roleMiddleware");

router.use(authMiddleware);
router.use(roleMiddleware);

const { getJobProcessStageFunctionalities } = require("./job-process-stage-functionality.controller");

router.get("/", getJobProcessStageFunctionalities);

module.exports = router;