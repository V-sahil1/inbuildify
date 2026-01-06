const express = require("express");
const router = express.Router();

const {
  getSalesProcessStageFunctionalities,
} = require("../controllers/sales-process-stage-functionality.controller");

const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

router.use(authMiddleware);
router.use(roleMiddleware);

router.get(
  "/",
  getSalesProcessStageFunctionalities
);

module.exports = router;