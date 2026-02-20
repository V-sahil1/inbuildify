const Joi = require("joi");

// Reusable rules
const uuidRule = Joi.string().uuid().required().messages({
  "string.guid": "ID must be a valid UUID",
  "any.required": "ID is required",
});

const optionalUuidRule = Joi.string().uuid().optional().allow(null).messages({
  "string.guid": "ID must be a valid UUID",
});

const stringRule = Joi.string().trim().messages({
  "string.base": "Must be a string",
  "string.empty": "Field cannot be empty",
});

const numericRule = Joi.number().precision(2).messages({
  "number.base": "Must be a number",
  "number.positive": "Must be a positive number",
});

const booleanRule = Joi.boolean().optional().messages({
  "boolean.base": "Must be a boolean value",
});

// Schemas
const createLotSchema = Joi.object({
  estate_id: optionalUuidRule,
  estate_stage_id: optionalUuidRule,
  lot_number: stringRule.max(255).required().messages({
    "any.required": "Lot number is required",
    "string.max": "Lot number must not exceed 255 characters",
  }),
  street: stringRule.max(255).required().messages({
    "any.required": "Street is required",
    "string.max": "Street must not exceed 255 characters",
  }),
  city: stringRule.max(255).required().messages({
    "any.required": "City is required",
    "string.max": "City must not exceed 255 characters",
  }),
  state_id: optionalUuidRule.required(),
  zip_code: stringRule.min(4).max(4).required().messages({
    "any.required": "Zip code is required",
    "string.max": "Zip code must not exceed 10 characters",
  }),
  title_status: stringRule
    .max(255)
    .optional()
    .allow("")
    .valid(
      "available",
      "sold",
      "reserved",
      "pending",
      "under_contract",
      "off_market",
    )
    .messages({
      "any.only":
        "Title status must be one of: available, sold, reserved, pending, under_contract, off_market",
    }),
  title_date: Joi.date().optional().allow(null).messages({
    "date.base": "Title date must be a valid date",
  }),
  lost_type: stringRule
    .max(100)
    .optional()
    .allow("")
    .valid("regular", "irregular")
    .default("regular")
    .messages({
      "any.only": "Lost type must be either regular or irregular",
    }),
  corner_block: booleanRule.default(false),
  width_m: numericRule.min(0).optional().allow(null),
  depth_m: numericRule.min(0).optional().allow(null),
  size_m2: numericRule.min(0).optional().allow(null),
  price: numericRule.min(0).optional().allow(null),
  site_fall_mm: numericRule.min(0).optional().allow(null),
  land_fill_mm: numericRule.min(0).optional().allow(null),
  total_size_m2: numericRule.min(0).optional().allow(null),
});

const updateLotSchema = Joi.object({
  estate_id: optionalUuidRule,
  estate_stage_id: optionalUuidRule,
  lot_number: stringRule.max(255).optional().messages({
    "string.max": "Lot number must not exceed 255 characters",
  }),
  street: stringRule.max(255).optional().messages({
    "string.max": "Street must not exceed 255 characters",
  }),
  city: stringRule.max(255).optional().messages({
    "string.max": "City must not exceed 255 characters",
  }),
  state_id: optionalUuidRule,
  zip_code: stringRule.min(4).max(4).optional().messages({
    "string.max": "Zip code must not exceed 10 characters",
  }),
  title_status: stringRule
    .max(255)
    .optional()
    .allow("")
    .valid(
      "available",
      "sold",
      "reserved",
      "pending",
      "under_contract",
      "off_market",
    )
    .messages({
      "any.only":
        "Title status must be one of: available, sold, reserved, pending, under_contract, off_market",
    }),
  title_date: Joi.date().optional().allow(null).messages({
    "date.base": "Title date must be a valid date",
  }),
  lost_type: stringRule
    .max(100)
    .optional()
    .allow("")
    .valid("regular", "irregular")
    .messages({
      "any.only": "Lost type must be either regular or irregular",
    }),
  corner_block: booleanRule,
  width_m: numericRule.min(0).optional().allow(null),
  depth_m: numericRule.min(0).optional().allow(null),
  size_m2: numericRule.min(0).optional().allow(null),
  price: numericRule.min(0).optional().allow(null),
  site_fall_mm: numericRule.min(0).optional().allow(null),
  land_fill_mm: numericRule.min(0).optional().allow(null),
  total_size_m2: numericRule.min(0).optional().allow(null),
});

const getLotByIdSchema = Joi.object({
  lot_id: uuidRule,
});

const deleteLotSchema = Joi.object({
  lot_id: uuidRule,
});

const getAllLotsSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1).messages({
    "number.base": "Page must be a number",
    "number.integer": "Page must be an integer",
    "number.min": "Page must be greater than 0",
  }),
  limit: Joi.number().integer().min(1).max(100).default(25).messages({
    "number.base": "Limit must be a number",
    "number.integer": "Limit must be an integer",
    "number.min": "Limit must be at least 1",
    "number.max": "Limit must not exceed 100",
  }),
  estate_id: optionalUuidRule,
  estate_stage_id: optionalUuidRule,
  title_status: stringRule.max(255).optional().allow(""),
  lost_type: stringRule
    .max(100)
    .optional()
    .allow("")
    .valid("regular", "irregular"),
  corner_block: booleanRule.optional(),
  min_price: numericRule.min(0).optional(),
  max_price: numericRule.min(0).optional(),
  min_size: numericRule.min(0).optional(),
  max_size: numericRule.min(0).optional(),
  search: stringRule.max(255).optional().allow(""),
});

module.exports = {
  createLotSchema,
  updateLotSchema,
  getLotByIdSchema,
  deleteLotSchema,
  getAllLotsSchema,
};
