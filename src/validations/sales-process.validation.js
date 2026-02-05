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
  deleteSalesProcessSchema,
  updateSalesProcessIdParamsSchema,
  updateSalesProcessSchema,
};
