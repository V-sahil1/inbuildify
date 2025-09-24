const Joi = require("joi");

const getAllColorCategoriesSchema = Joi.object({
  limit: Joi.number().optional().default(25).max(50),
  offset: Joi.number().optional().default(0).max(1000),
});

const createColorCategorySchema = Joi.object({
  name: Joi.string().required().min(2).max(100),
  description: Joi.string().optional(),
});

const updateColorCategorySchema = Joi.object({
  name: Joi.string().optional().min(2).max(100),
  description: Joi.string().optional(),
}).min(1).message({ "object.min": "At least one field is required to update" });

const colorCategoryIdParamSchema = Joi.object({
  color_category_id: Joi.string().uuid().required().messages({
    "string.guid": "Color Category ID must be a valid UUID",
    "any.required": "Color Category ID is required",
  }),
});

module.exports = {
  getAllColorCategoriesSchema,
  createColorCategorySchema,
  updateColorCategorySchema,
  colorCategoryIdParamSchema,
};
