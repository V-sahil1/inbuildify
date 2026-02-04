const Joi = require("joi");

const createColorCategorySchema = Joi.object({
  color_id: Joi.string().uuid().required().messages({
    "string.guid": "Color ID must be a valid UUID",
    "any.required": "Color ID is required",
  }),
  category_name: Joi.string()
    .trim()
    .min(2)
    .max(255)
    .required()
    .pattern(/^(?=.*[a-zA-Z])[a-zA-Z0-9\s,./#-]+$/)
    .messages({
      "any.required": "Category name is required",
      "string.max": "Category name must not exceed 255 characters",
    }),
  selection_type: Joi.string()
    .max(100)
    .valid("single", "multiple")
    .default("multiple")
    .messages({
      "any.only": "Selection type must be either 'single' or 'multiple'",
    }),
  sort_order: Joi.number().integer().default(1).messages({
    "number.base": "Sort order must be a number",
    "number.integer": "Sort order must be an integer",
  }),
  status: Joi.boolean().default(true).messages({
    "boolean.base": "Status must be a boolean",
  }),
  suppliers: Joi.array().items(Joi.string().uuid()).default([]).messages({
    "array.base": "Suppliers must be an array",
    "string.guid": "Each supplier ID must be a valid UUID",
  }),
  color_group: Joi.array().items(Joi.string().uuid()).default([]).messages({
    "array.base": "Color group must be an array",
    "string.guid": "Each color group ID must be a valid UUID",
  }),
});

const updateColorCategorySchema = Joi.object({
  category_name: Joi.string()
    .trim()
    .min(2)
    .max(255)
    .pattern(/^(?=.*[a-zA-Z])[a-zA-Z0-9\s,./#-]+$/)
    .optional()
    .messages({
      "string.max": "Category name must not exceed 255 characters",
    }),
  selection_type: Joi.string()
    .max(100)
    .valid("single", "multiple")
    .optional()
    .messages({
      "any.only": "Selection type must be either 'single' or 'multiple'",
    }),
  sort_order: Joi.number().integer().optional().messages({
    "number.base": "Sort order must be a number",
    "number.integer": "Sort order must be an integer",
  }),
  status: Joi.boolean().optional().messages({
    "boolean.base": "Status must be a boolean",
  }),
  suppliers: Joi.array().items(Joi.string().uuid()).optional().messages({
    "array.base": "Suppliers must be an array",
    "string.guid": "Each supplier ID must be a valid UUID",
  }),
  color_group: Joi.array().items(Joi.string().uuid()).optional().messages({
    "array.base": "Color group must be an array",
    "string.guid": "Each color group ID must be a valid UUID",
  }),
})
  .min(1)
  .message({
    "object.min": "At least one field must be provided for update",
  });

const paramsIdSchema = Joi.object({
  id: Joi.string().uuid().required().messages({
    "string.guid": "ID must be a valid UUID",
    "any.required": "ID is required",
  }),
});

module.exports = {
  createColorCategorySchema,
  updateColorCategorySchema,
  paramsIdSchema,
};
