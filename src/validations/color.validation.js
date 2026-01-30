const Joi = require("joi");

const createColorSchema = Joi.object({
  color_name: Joi.string().trim().max(255).required().messages({
    "any.required": "Color name is required",
    "string.max": "Color name must not exceed 255 characters",
  }),
  sort_order: Joi.number().integer().default(1).messages({
    "number.base": "Sort order must be a number",
    "number.integer": "Sort order must be an integer",
  }),
  status: Joi.boolean().default(true).messages({
    "boolean.base": "Status must be a boolean",
  }),
});

const updateColorSchema = Joi.object({
  color_name: Joi.string().trim().max(255).optional().messages({
    "string.max": "Color name must not exceed 255 characters",
  }),
  sort_order: Joi.number().integer().optional().messages({
    "number.base": "Sort order must be a number",
    "number.integer": "Sort order must be an integer",
  }),
  status: Joi.boolean().optional().messages({
    "boolean.base": "Status must be a boolean",
  }),
});

module.exports = {
  createColorSchema,
  updateColorSchema,
};
