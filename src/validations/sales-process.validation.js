const Joi = require("joi");

const createSalesProccessSchema = Joi.object({
  name: Joi.string()
    .trim()
    .min(2)
    .max(150)
    .pattern(/^(?=.*[a-zA-Z])[a-zA-Z0-9\s,./#-]+$/)
    .required(),
  is_default: Joi.boolean().default(false),
});

const getAllSalesProccessSchema = Joi.object({
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

const deleteSalesProcessSchema = Joi.object({
  id: Joi.string().uuid().required().messages({
    "string.guid": "Sales process ID must be a valid UUID",
    "any.required": "Sales process ID is required",
  }),
});

const updateSalesProcessIdParamsSchema = Joi.object({
  id: Joi.string().uuid().required().messages({
    "string.guid": "Sales process ID must be a valid UUID",
    "any.required": "Sales process ID is required",
  }),
});

const updateSalesProcessSchema = Joi.object({
  name: Joi.string()
    .trim()
    .min(2)
    .max(150)
    .pattern(/^(?=.*[a-zA-Z])[a-zA-Z0-9\s,./#-]+$/)
    .optional(),
  is_default: Joi.boolean().default(false),
});

module.exports = {
  createSalesProccessSchema,
  getAllSalesProccessSchema,
  deleteSalesProcessSchema,
  updateSalesProcessIdParamsSchema,
  updateSalesProcessSchema,
};
