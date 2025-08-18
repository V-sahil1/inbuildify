const express = require("express");
const router = express.Router();
const {
  createBuilder,
  getBuilders,
  getBuilderById,
  updateBuilder,
  deleteBuilder,
} = require("../controllers/builder.controller");
const authMiddleware = require("../middleware/authMiddleware.js");
const roleMiddleware = require("../middleware/roleMiddleware.js");

router.post("/", authMiddleware, roleMiddleware, createBuilder);
router.get("/", authMiddleware, roleMiddleware, getBuilders);
router.get("/:id", authMiddleware, roleMiddleware, getBuilderById);
router.put("/:id", authMiddleware, roleMiddleware, updateBuilder);
router.delete("/:id", authMiddleware, roleMiddleware, deleteBuilder);

module.exports = router;
