const Joi = require("joi");

const createSuppllierTypeSchema = Joi.object({
  name: Joi.string()
    .trim()
    .min(2)
    .max(150)
    .pattern(/^(?=.*[a-zA-Z])[a-zA-Z0-9\s,./#-]+$/)
    .required()
    .messages({
      "any.required": "name is required",
    }),
  is_active: Joi.boolean().default(true),
});

const getAllSupllierTypeSchema = Joi.object({
  is_active: Joi.boolean().optional(),
  page: Joi.number().integer().min(1).default(1).messages({
    "number.base": "Page must be a number",
    "number.integer": "Page must be an integer",
    "number.min": "Page must be greater than 0",
  }),

  limit: Joi.number().integer().min(1).max(100).default(10).messages({
    "number.base": "Limit must be a number",
    "number.integer": "Limit must be an integer",
    "number.min": "Limit must be at least 1",
    "number.max": "Limit must not exceed 100",
  }),
});

const deleteSupplierTypeSchema = Joi.object({
  supplier_type_id: Joi.string().uuid().required().messages({
    "string.guid": " ID must be a valid UUID",
    "any.required": " ID is required",
  }),
});

const updateSupplierTypeParamsSchema = Joi.object({
  supplier_type_id: Joi.string().uuid().required().messages({
    "string.guid": "supplier type ID must be a valid UUID",
    "any.required": " supplier type ID is required",
  }),
});

const updateSupplierTypeSchema = Joi.object({
  name: Joi.string()
    .trim()
    .min(2)
    .max(150)
    .pattern(/^(?=.*[a-zA-Z])[a-zA-Z0-9\s,./#-]+$/)
    .optional(),
  is_active: Joi.boolean().optional(),
});
module.exports = {
  createSuppllierTypeSchema,
  getAllSupllierTypeSchema,
  deleteSupplierTypeSchema,
  updateSupplierTypeParamsSchema,
  updateSupplierTypeSchema,
};
