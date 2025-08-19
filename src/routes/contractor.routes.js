const express = require("express");
const router = express.Router();
const {
  createContractor,
} = require("../controllers/contractor.controller");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const { validateRequest } = require("../middleware/validateRequestMiddleware");
const { createContractorSchema } = require("../validations/contractor.validation");

router.use(authMiddleware)

router.post("/", validateRequest(createContractorSchema), roleMiddleware, createContractor);

module.exports = router;
