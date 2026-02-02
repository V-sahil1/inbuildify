const Joi = require("joi");

const createConstructiontyeSchema = Joi.object({
  builder: Joi.string().uuid().required().messages({
    "string.guid": "builder ID must be a valid UUID",
    "any.required": "builder ID is required",
  }),

  types_name: Joi.string()
    .min(2)
    .trim()
    .max(255)
    .pattern(/^(?=.*[a-zA-Z])[a-zA-Z0-9\s,./#-]+$/)
    .required(),

  start_construction_days: Joi.number()
    .integer()
    .min(1)
    .max(365)
    .default(21)
    .optional(),
  sort_order: Joi.number().integer().min(1).default(1).optional(),
  dwelling_type: Joi.array()
    .items(Joi.string().uuid())
    .default([])
    .optional()
    .messages({
      "string.guid": "dwelling type ID must be a valid UUID",
    }),
});

const getAllConstructionTypeSchema = Joi.object({
  builder: Joi.string().uuid().optional().messages({
    "string.guid": "builder ID must be a valid UUID",
    "any.required": "builder ID is required",
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

const deleteConstructionTypeSchema = Joi.object({
  construction_type_id: Joi.string().uuid().required().messages({
    "string.guid": "construction type ID must be a valid UUID",
    "any.required": "construction type ID is required",
  }),
});

const updateConstructionTypeParamsSchema = Joi.object({
  construction_type_id: Joi.string().uuid().required().messages({
    "string.guid": "construction type ID must be a valid UUID",
    "any.required": "construction type ID is required",
  }),
});

const updateConstructionTypeSchema = Joi.object({
  types_name: Joi.string()
    .trim()
    .min(2)
    .max(255)
    .pattern(/^(?=.*[a-zA-Z])[a-zA-Z0-9\s,./#-]+$/)
    .optional(),
  start_construction_days: Joi.number().integer().min(1).max(365).optional(),
  sort_order: Joi.number().integer().min(1).optional(),
  dwelling_type: Joi.array()
    .items(Joi.string().uuid())
    .default([])
    .optional()
    .messages({
      "string.guid": "dwelling type ID must be a valid UUID",
    }),
});
module.exports = {
  createConstructiontyeSchema,
  getAllConstructionTypeSchema,
  deleteConstructionTypeSchema,
  updateConstructionTypeParamsSchema,
  updateConstructionTypeSchema,
};
