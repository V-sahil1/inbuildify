const Joi = require("joi");

const createPriceListSchema = Joi.object({
  name: Joi.string().min(1).max(200).required(),
  sort_order: Joi.number().integer().min(0).default(0).optional(),
  show_in_view_list: Joi.boolean().default(true),
  is_active: Joi.boolean().default(true),
  location: Joi.string().uuid().allow(null).optional().messages({
    "string.guid": "state location ID must be a valid UUID",
  }),
});

const getAllPriceListSchema = Joi.object({
  is_active: Joi.boolean().optional(),
  search: Joi.string().trim().max(200).optional(),
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

const deletePriceListSchema = Joi.object({
  priceListId: Joi.string().uuid().required().messages({
    "string.guid": "price list ID must be a valid UUID",
    "any.required": "price list ID is required",
  }),
});

const updatePriceListParamsSchema = Joi.object({
  priceListId: Joi.string().uuid().required().messages({
    "string.guid": "price list ID must be a valid UUID",
    "any.required": "price list ID is required",
  }),
});

const updatePriceListSchema = Joi.object({
  name: Joi.string().min(1).max(200).optional(),
  sort_order: Joi.number().integer().min(0).default(0).optional(),
  show_in_view_list: Joi.boolean(),
  is_active: Joi.boolean(),
  location: Joi.string().uuid().allow(null).optional().messages({
    "string.guid": "state location ID must be a valid UUID",
  }),
});

module.exports = {
  createPriceListSchema,
  getAllPriceListSchema,
  deletePriceListSchema,
  updatePriceListParamsSchema,
  updatePriceListSchema,
};
