const express = require("express");
const router = express.Router();
const {
  createContractor,
  getContractors,
  getContractorById,
  updateContractor,
  deleteContractor
} = require("../controllers/contractor.controller");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const { validateRequest } = require("../middleware/validateRequestMiddleware");
const { createContractorSchema } = require("../validations/contractor.validation");

router.use(authMiddleware)
router.use(roleMiddleware)

router.post("/", validateRequest(createContractorSchema), createContractor);
router.get("/", getContractors);
router.get("/:id", getContractorById);
router.put("/:id", updateContractor);
router.delete("/:id", deleteContractor);

module.exports = router;
