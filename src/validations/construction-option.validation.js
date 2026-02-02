const Joi = require("joi");

const createConstructionOptionSchema = Joi.object({
  option_name: Joi.string()
    .trim()
    .min(2)
    .max(255)
    .pattern(/^(?=.*[a-zA-Z])[a-zA-Z0-9\s,./#-]+$/)
    .required(),
});

const getAllConstructionOptionSchema = Joi.object({
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

const deleteConstructionOptionSchema = Joi.object({
  id: Joi.string().uuid().required().messages({
    "string.guid": "construction option ID must be a valid UUID",
    "any.required": "construction option ID is required",
  }),
});

const updateConstructionOptionParamsSchema = Joi.object({
  id: Joi.string().uuid().required().messages({
    "string.guid": "construction option ID must be a valid UUID",
    "any.required": "construction option ID is required",
  }),
});

const updateConstructionOptionSchema = Joi.object({
  option_name: Joi.string()
    .min(2)
    .trim()
    .max(255)
    .pattern(/^(?=.*[a-zA-Z])[a-zA-Z0-9\s,./#-]+$/)
    .optional(),
});

module.exports = {
  createConstructionOptionSchema,
  getAllConstructionOptionSchema,
  deleteConstructionOptionSchema,
  updateConstructionOptionParamsSchema,
  updateConstructionOptionSchema,
};
