const Joi = require("joi");

const createPriceListItemSchema = Joi.object({
  price_list_id: Joi.string().uuid().required().messages({
    "any.required": "price_list_id is required",
    "string.uuid": "price_list_id must be a valid UUID",
  }),

  item_description: Joi.string().required().messages({
    "any.required": "item_description is required",
  }),

  short_description: Joi.string().allow(null, "").max(255),

  cost_type: Joi.string()
    .valid("Included", "Fixed", "Variable")
    .required()
    .max(50)
    .messages({
      "any.required": "cost_type is required",
      "any.only": "cost_type must be one of: Included, Fixed, Variable",
    }),

  cost_type_text: Joi.string().allow(null, "").trim().max(255),

  cost_option: Joi.string().valid("none", "tba", "tbc").default("none").max(50),

  cost: Joi.number().precision(2).allow(null),

  builder_cost: Joi.number().precision(2).allow(null),

  sort_order: Joi.number().integer().min(0).default(0).optional(),

  uom: Joi.string().allow(null, "").trim().max(50),

  status: Joi.string()
    .valid("active", "inactive")
    .default("active")
    .trim()
    .max(20),

  include_by_default: Joi.boolean().default(false),

  allow_remove_from_quotation: Joi.boolean().default(false),

  show_in_hl_package: Joi.boolean().default(false),

  show_only_in_package: Joi.boolean().default(false),

  range_id: Joi.array().items(Joi.string().uuid()).optional().messages({
    "array.includes": "Each range ID must be a valid UUID",
  }),

  dwelling_type_id: Joi.array().items(Joi.string().uuid()).optional().messages({
    "array.includes": "Each dwelling type ID must be a valid UUID",
  }),
});

const getAllPriceListItemSchema = Joi.object({
  status: Joi.string().valid("active", "inactive").optional(),

  cost_option: Joi.string().valid("none", "tba", "tbc").optional(),

  price: Joi.number().precision(2).optional(),

  item_description: Joi.string().max(255).optional(),

  sort_order: Joi.string().valid("asc", "desc").default("asc"),

  price_list_id: Joi.string().uuid().optional().messages({
    "string.uuid": "price_list_id must be a valid UUID",
  }),

  range_id: Joi.string().uuid().optional().messages({
    "string.uuid": "range_id must be a valid UUID",
  }),

  dwelling_type_id: Joi.string().uuid().optional().messages({
    "string.uuid": "dwelling_type_id must be a valid UUID",
  }),

  location_id: Joi.string().uuid().optional().messages({
    "string.uuid": "location_id must be a valid UUID",
  }),

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

const deletePriceListItemSchema = Joi.object({
  priceListItemId: Joi.string().uuid().required().messages({
    "string.guid": "Price list item ID must be a valid UUID",
    "any.required": "Price list item ID is required",
  }),
});

const updatePriceListItemSParamschema = Joi.object({
  price_list_item_id: Joi.string().uuid().required().messages({
    "string.guid": "Price list item ID must be a valid UUID",
    "any.required": "Price list item ID is required",
  }),
});

const updatePriceListItemSchema = Joi.object({
  item_description: Joi.string().optional().trim().max(2000),

  short_description: Joi.string().allow(null, "").max(255).optional(),

  cost_type: Joi.string()
    .valid("Included", "Fixed", "Variable")
    .optional()
    .max(50)
    .messages({
      "any.only": "cost_type must be one of: Included, Fixed, Variable",
    }),

  cost_type_text: Joi.string().allow(null, "").trim().max(255).optional(),

  cost_option: Joi.string()
    .valid("none", "tba", "tbc")
    .default("none")
    .max(50)
    .optional(),

  cost: Joi.number().precision(2).allow(null).optional(),

  builder_cost: Joi.number().precision(2).allow(null).optional(),

  sort_order: Joi.number().integer().min(0).default(0).optional(),

  uom: Joi.string().allow(null, "").trim().max(50).optional(),

  status: Joi.string()
    .valid("active", "inactive")
    .default("active")
    .trim()
    .max(20)
    .optional(),

  include_by_default: Joi.boolean(),

  allow_remove_from_quotation: Joi.boolean(),

  show_in_hl_package: Joi.boolean(),

  show_only_in_package: Joi.boolean(),

  range_id: Joi.array().items(Joi.string().uuid()).optional().messages({
    "array.includes": "Each range ID must be a valid UUID",
  }),

  dwelling_type_id: Joi.array().items(Joi.string().uuid()).optional().messages({
    "array.includes": "Each dwelling type ID must be a valid UUID",
  }),
})
  .min(1)
  .messages({
    "object.min": "At least one field is required to update.",
  });

module.exports = {
  createPriceListItemSchema,
  getAllPriceListItemSchema,
  deletePriceListItemSchema,
  updatePriceListItemSParamschema,
  updatePriceListItemSchema,
};
