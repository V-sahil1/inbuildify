const Joi = require("joi");

const getAllColorSubCategoriesSchema = Joi.object({
  limit: Joi.number().optional().default(25).max(50),
  offset: Joi.number().optional().default(0).max(1000),
  colorCategoryId: Joi.string().uuid().optional(),
});

const getAllColorSubCategoriesParamsSchema = Joi.object({
  color_category_id: Joi.string().uuid().required().messages({
    "string.guid": "Color Category ID must be a valid UUID",
    "any.required": "Color Category ID is required",
  }),
});

const createColorSubCategorySchema = Joi.object({
  colorCategoryId: Joi.string().uuid().required().messages({
    "string.guid": "Color Category ID must be a valid UUID",
    "any.required": "Color Category ID is required",
  }),
  name: Joi.string().required().min(2).max(100),
  description: Joi.string().optional(),
});

const updateColorSubCategorySchema = Joi.object({
  name: Joi.string().optional().min(2).max(100),
  description: Joi.string().optional(),
}).min(1).message({ "object.min": "At least one field is required to update" });

const colorSubCategoryIdParamSchema = Joi.object({
  color_sub_category_id: Joi.string().uuid().required().messages({
    "string.guid": "Color Sub-Category ID must be a valid UUID",
    "any.required": "Color Sub-Category ID is required",
  }),
});

module.exports = {
  getAllColorSubCategoriesSchema,
  getAllColorSubCategoriesParamsSchema,
  createColorSubCategorySchema,
  updateColorSubCategorySchema,
  colorSubCategoryIdParamSchema,
};
