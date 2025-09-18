const Joi = require("joi");

const getAllCategoriesSchema = Joi.object({
  limit: Joi.number().optional().default(25).max(50),
  offset: Joi.number().optional().default(0).max(25),
});

const createCategorySchema = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().optional(),
});

const updateCategorySchema = Joi.object({
  name: Joi.string().optional(),
  description: Joi.string().optional()
}).min(1).message({"object.min": "At least one field is required to update"});

const displayOrderManageSchema = Joi.object({
  orderedCategories: Joi.array()
    .items(
      Joi.object({
        categoryId: Joi.string().uuid().required().messages({
          "string.guid": "Category ID must be a valid UUID",
          "any.required": "Category ID is required",
        }),
        displayOrder: Joi.number().integer().required().messages({
          "number.base": "Display Order must be a number",
          "number.integer": "Display Order must be an integer",
          "any.required": "Display Order is required",
        }),
      })
    )
    .required()
    .messages({
      "array.base": "orderedCategories must be an array of objects with categoryId and displayOrder",
    }),
}).unknown(false);

const deleteCategorySchema = Joi.object({
  id: Joi.string().uuid().required().messages({
    "string.guid": "Category ID must be a valid UUID",
    "any.required": "Category ID is required",
  }),
});

const getCategoryByIdSchema = Joi.object({
  id: Joi.string().uuid().required().messages({
    "string.guid": "Category ID must be a valid UUID",
    "any.required": "Category ID is required",
  }),
});

module.exports = {
  getAllCategoriesSchema,
  createCategorySchema,
  updateCategorySchema,
  displayOrderManageSchema,
  deleteCategorySchema,
  getCategoryByIdSchema,
};
