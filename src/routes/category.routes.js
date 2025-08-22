const express = require("express");
const router = express.Router();
const { getAllCategories } = require("../controllers/category.controller");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const { validateRequest } = require("../middleware/validateRequestMiddleware");
const { getAllCategoriesSchema } = require("../validations/category.validation");
const { REQUEST_SOURCE } = require("../config/constants");

router.get("/", validateRequest(getAllCategoriesSchema, REQUEST_SOURCE.QUERY), authMiddleware, roleMiddleware, getAllCategories)

module.exports = router;
