const express = require('express');
const router = express.Router();
const { createCategoryItem, getCategoryItemsByCategoryId, updateCategoryItem, deleteCategoryItem } = require('../controllers/categoryItems.controller');
const { validateRequest } = require('../middleware/validateRequestMiddleware');
const { createCategoryItemSchema, getCategoryItemsByCategoryIdSchema, updateCategoryItemSchema, deleteCategoryItemSchema } = require('../validations/category-item.validation');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const { REQUEST_SOURCE } = require('../config/constants');

router.use(authMiddleware);
router.use(roleMiddleware);

router.post('/', validateRequest(createCategoryItemSchema), createCategoryItem);
router.get('/:category_id', validateRequest(getCategoryItemsByCategoryIdSchema, REQUEST_SOURCE.QUERY), getCategoryItemsByCategoryId);
router.put('/:category_item_id', validateRequest(updateCategoryItemSchema), updateCategoryItem);
router.delete('/:category_item_id', validateRequest(deleteCategoryItemSchema, REQUEST_SOURCE.PARAMS), deleteCategoryItem);

module.exports = router;
