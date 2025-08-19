const express = require("express");
const router = express.Router();
const {
  createBuilder,
  getBuilders,
  getBuilderById,
  updateBuilder,
  deleteBuilder,
} = require("../controllers/builder.controller");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

router.use(authMiddleware)

router.post("/", roleMiddleware, createBuilder);
router.get("/", roleMiddleware, getBuilders);
router.get("/:id", roleMiddleware, getBuilderById);
router.put("/:id", roleMiddleware, updateBuilder);
router.delete("/:id", roleMiddleware, deleteBuilder);

module.exports = router;
