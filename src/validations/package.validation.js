const Joi = require("joi");

const createPackageSchema = Joi.object({
  name: Joi.string().trim().max(200).required(),

  cost: Joi.number()
    .precision(2)
    .min(0)
    .max(9999999999.99)
    .optional()
    .allow(null),
  builder_cost: Joi.number()
    .precision(2)
    .min(0)
    .max(9999999999.99)
    .optional()
    .allow(null),

  sort_order: Joi.number().integer().default(0).min(0).optional(),

  status: Joi.boolean().optional().default(true),

  range_id: Joi.array().items(Joi.string().uuid()).optional().messages({
    "array.includes": "Each range ID must be a valid UUID",
  }),

  dwelling_type_id: Joi.array().items(Joi.string().uuid()).optional().messages({
    "array.includes": "Each dwelling type ID must be a valid UUID",
  }),

  allow_add_item_from_pricelist: Joi.boolean().optional().default(false),
  allow_remove_package_items: Joi.boolean().optional().default(true),
});

const getAllPackagesSchema = Joi.object({
  name: Joi.string().max(200).optional(),
  status: Joi.boolean().optional(),
  cost: Joi.number()
    .precision(2)
    .min(0)
    .max(9999999999.99)
    .optional()
    .allow(null),
  sort_order: Joi.string().trim().valid("ASC", "DESC").optional(),

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

const updatePackageParamsSchema = Joi.object({
  package_id: Joi.string().uuid().required().messages({
    "string.guid": "Package ID must be a valid UUID",
    "any.required": "Package ID is required",
  }),
});
const updatePackageSchema = Joi.object({
  name: Joi.string().trim().max(200).optional(),

  cost: Joi.number()
    .precision(2)
    .min(0)
    .max(9999999999.99)
    .optional()
    .allow(null),
  builder_cost: Joi.number()
    .precision(2)
    .min(0)
    .max(9999999999.99)
    .optional()
    .allow(null),

  sort_order: Joi.number().integer().default(0).min(0).optional(),

  status: Joi.boolean().optional(),

  range_id: Joi.array().items(Joi.string().uuid()).optional().messages({
    "array.includes": "Each range ID must be a valid UUID",
  }),

  dwelling_type_id: Joi.array().items(Joi.string().uuid()).optional().messages({
    "array.includes": "Each dwelling type ID must be a valid UUID",
  }),

  allow_add_item_from_pricelist: Joi.boolean().optional(),
  allow_remove_package_items: Joi.boolean().optional(),
});

const deletePackageSchema = Joi.object({
  package_id: Joi.string().uuid().required().messages({
    "string.guid": "Package ID must be a valid UUID",
    "any.required": "Package ID is required",
  }),
});

module.exports = {
  createPackageSchema,
  getAllPackagesSchema,
  updatePackageParamsSchema,
  updatePackageSchema,
  deletePackageSchema,
};
