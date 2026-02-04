const Joi = require("joi");

const createEstateSchema = Joi.object({
  name: Joi.string()
    .min(2)
    .max(150)
    .pattern(/^(?=.*[a-zA-Z])[a-zA-Z0-9\s,./#-]+$/)
    .required(),

  street_name: Joi.string()
    .min(2)
    .max(150)
    .pattern(/^(?=.*[a-zA-Z])[a-zA-Z0-9\s,./#-]+$/)
    .optional(),

  city: Joi.string()
    .min(2)
    .max(100)
    .pattern(/^(?=.*[a-zA-Z])[a-zA-Z0-9\s,./#-]+$/)
    .allow(null, "")
    .optional(),

  state_id: Joi.string().uuid().allow(null, "").optional().messages({
    "string.guid": "state ID must be a valid UUID.",
  }),

  country_id: Joi.string().uuid().allow(null, "").optional().messages({
    "string.guid": "country ID must be a valid UUID.",
  }),

  zip: Joi.string().min(4).max(4).allow(null, "").optional(),

  estate_logo: Joi.string().max(500).allow(null, "").optional(),

  website: Joi.string().uri().max(255).allow(null, "").optional(),

  description: Joi.string()
    .max(4000)
    .pattern(/^(?=.*[a-zA-Z])[a-zA-Z0-9\s,./#-]+$/)
    .allow(null, "")
    .optional(),

  status: Joi.boolean().default(true),

  featured: Joi.boolean().default(false),
});

const getAllEstateSchema = Joi.object({
  name: Joi.string().max(150).optional(),
  status: Joi.boolean().optional(),

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

const deleteEstateSchema = Joi.object({
  estate_id: Joi.string().uuid().required().messages({
    "string.guid": "estate ID must be a valid UUID",
    "any.required": "estate ID is required",
  }),
});

const updateEstateParamsSchema = Joi.object({
  estate_id: Joi.string().uuid().optional().messages({
    "string.guid": "estate ID must be a valid UUID",
    "any.required": "estate ID is required",
  }),
});

const updateEstateSchema = Joi.object({
  name: Joi.string()
    .min(2)
    .max(150)
    .pattern(/^(?=.*[a-zA-Z])[a-zA-Z0-9\s,./#-]+$/)
    .optional(),

  street_name: Joi.string()
    .max(150)
    .allow(null, "")
    .pattern(/^(?=.*[a-zA-Z])[a-zA-Z0-9\s,./#-]+$/)
    .optional(),

  city: Joi.string()
    .max(100)
    .pattern(/^(?=.*[a-zA-Z])[a-zA-Z0-9\s,./#-]+$/)
    .allow(null, "")
    .optional(),

  state_id: Joi.string().uuid().allow(null, "").optional().messages({
    "string.guid": "state ID must be a valid UUID.",
  }),

  country_id: Joi.string().uuid().allow(null, "").optional().messages({
    "string.guid": "country ID must be a valid UUID.",
  }),

  zip: Joi.string().min(4).max(4).allow(null, "").optional(),

  estate_logo: Joi.string().max(500).allow(null, "").optional(),

  website: Joi.string().uri().max(255).allow(null, "").optional(),

  description: Joi.string()
    .max(4000)
    .pattern(/^[^<>]*$/)
    .allow(null, "")
    .optional(),

  status: Joi.boolean().optional(),

  featured: Joi.boolean().optional(),
});

module.exports = {
  createEstateSchema,
  getAllEstateSchema,
  deleteEstateSchema,
  updateEstateParamsSchema,
  updateEstateSchema,
};
