const Joi = require("joi");

const createJobInvoiceStagePaymentSchema = Joi.object({
  description: Joi.string()
    .trim()
    .min(2)
    .max(150)
    .required()
    .pattern(/^(?=.*[a-zA-Z])[a-zA-Z0-9\s,./#-]+$/)
    .messages({
      "string.base": "Description must be a string.",
      "string.empty": "Description is required.",
      "string.max": "Description cannot exceed 150 characters.",
      "any.required": "Description is required.",
    }),

  percentage: Joi.number()
    .min(0.0)
    .max(100.0)
    .precision(2)
    .optional()
    .messages({
      "number.base": "Percentage must be a number.",
      "number.min": "Percentage cannot be less than 0.",
      "number.max": "Percentage cannot be greater than 100.",
    }),

  sort_order: Joi.number().integer().min(1).optional().messages({
    "number.base": "Sort order must be a number.",
    "number.min": "Sort order must be at least 1.",
  }),
});

const getAllJobInvoiceStagePaymentSchema = Joi.object({
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

const deleteJobInvoiceStagePaymentSchema = Joi.object({
  id: Joi.string().uuid().required().messages({
    "string.guid": "job invoice stage payment ID must be a valid UUID",
    "any.required": "job invoice stage payment ID is required",
  }),
});

const updateJobInvoiceStagePaymentParamsSchema = Joi.object({
  job_invoice_stage_payment_id: Joi.string().uuid().required().messages({
    "string.guid": "job invoice stage payment ID must be a valid UUID",
    "any.required": "job invoice stage payment ID is required",
  }),
});

const updateJobInvoiceStagePaymentSchema = Joi.object({
  description: Joi.string()
    .trim()
    .min(2)
    .max(150)
    .pattern(/^(?=.*[a-zA-Z])[a-zA-Z0-9\s,./#-]+$/)
    .optional()
    .messages({
      "string.base": "Description must be a string.",
      "string.max": "Description cannot exceed 150 characters.",
    }),

  percentage: Joi.number()
    .min(0.0)
    .max(100.0)
    .precision(2)
    .optional()
    .messages({
      "number.base": "Percentage must be a number.",
      "number.min": "Percentage cannot be less than 0.",
      "number.max": "Percentage cannot be greater than 100.",
    }),

  sort_order: Joi.number().integer().min(1).optional().messages({
    "number.base": "Sort order must be a number.",
    "number.min": "Sort order must be at least 1.",
  }),
});

module.exports = {
  createJobInvoiceStagePaymentSchema,
  getAllJobInvoiceStagePaymentSchema,
  deleteJobInvoiceStagePaymentSchema,
  updateJobInvoiceStagePaymentParamsSchema,
  updateJobInvoiceStagePaymentSchema,
};
