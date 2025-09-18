const express = require("express");
const router = express.Router();
const { getAllCategories, createCategory,
    updateCategory,
    deleteCategory,
    getCategoryById,
    displayOrderManage
} = require("../controllers/category.controller");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const { validateRequest } = require("../middleware/validateRequestMiddleware");
const { 
    getAllCategoriesSchema, 
    createCategorySchema,
    updateCategorySchema,
    displayOrderManageSchema,
    deleteCategorySchema,
    getCategoryByIdSchema 
} = require("../validations/category.validation");
const { REQUEST_SOURCE } = require("../config/constants");

router.use(authMiddleware);
router.use(roleMiddleware);

router.get("/", validateRequest(getAllCategoriesSchema, REQUEST_SOURCE.QUERY), getAllCategories)
router.get("/:id", validateRequest(getCategoryByIdSchema, REQUEST_SOURCE.PARAMS), getCategoryById);
router.post("/", validateRequest(createCategorySchema, REQUEST_SOURCE.BODY), createCategory);
router.put("/:id", validateRequest(updateCategorySchema, REQUEST_SOURCE.BODY), updateCategory);
router.put("/order/display-order", validateRequest(displayOrderManageSchema, REQUEST_SOURCE.BODY), displayOrderManage);
router.delete("/:id", validateRequest(deleteCategorySchema, REQUEST_SOURCE.PARAMS), deleteCategory);

module.exports = router;
