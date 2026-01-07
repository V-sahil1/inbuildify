const Joi = require("joi");

const createTemplateEmailSchema = Joi.object({
  name: Joi.string().min(3).max(200).required().messages({
    "string.empty": "Template name is required.",
  }),
  type: Joi.string()
    .max(50)
    .valid("standard", "customized")
    .default("standard"),
  subject: Joi.string().allow(null, "").max(255).optional(),
  email_content: Joi.string().required().messages({
    "string.empty": "Email content is required.",
  }),
  additional_recipient_users: Joi.array()
    .items(Joi.string().uuid())
    .default([])
    .messages({
      "string.guid": "Additional recipient users ID must be a valid UUID",
    }),
  additional_recipient_groups: Joi.array()
    .items(Joi.string().uuid())
    .default([])
    .messages({
      "string.guid": "Additional recipient group ID must be a valid UUID",
    }),
  is_active: Joi.boolean().default(true),
});

const getAllTemplateEmailSchema = Joi.object({
  name: Joi.string().max(200).optional(),
  type: Joi.string().valid("standard", "customized").optional(),
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

const updateTemplateEmailParamsSchema = Joi.object({
  id: Joi.string().uuid().required().messages({
    "string.guid": "template email ID must be a valid UUID",
    "any.required": "template email ID is required",
  }),
});

const updateTemplateEmailSchem = Joi.object({

  subject: Joi.string().allow(null, "").max(255).optional(),
  email_content: Joi.string().optional(),
  additional_recipient_users: Joi.array()
    .items(Joi.string().uuid())
    .default([])
    .messages({
      "string.guid": "Additional recipient users ID must be a valid UUID",
    }),
  additional_recipient_groups: Joi.array()
    .items(Joi.string().uuid())
    .default([])
    .messages({
      "string.guid": "Additional recipient group ID must be a valid UUID",
    }),
});

const deleteTemplateEmailSchema = Joi.object({
  template_email_id: Joi.string().uuid().required().messages({
    "string.guid": "template email ID must be a valid UUID",
    "any.required": "template email ID is required",
  }),
});

const updateTemplateEmailIsActiveSchema = Joi.object({
  is_active: Joi.boolean().required(),
});

module.exports = {
  createTemplateEmailSchema,
  getAllTemplateEmailSchema,
  updateTemplateEmailParamsSchema,
  updateTemplateEmailSchem,
  deleteTemplateEmailSchema,
  updateTemplateEmailIsActiveSchema,
};
