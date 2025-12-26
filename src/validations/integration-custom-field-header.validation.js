const Joi = require("joi");

const createIntegrationCustomFieldHeaderSchema = Joi.object({
  header_name: Joi.string().trim().max(150).required(),
  sort_order: Joi.number().integer().default(0).min(0).optional(),
  is_active: Joi.boolean().default(true),
});

const getAllIntegrationCustomFieldHeaderSchema = Joi.object({
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

const deleteIntegrationCustomFieldHeaderSchema = Joi.object({
  integration_custom_field_header_id: Joi.string().uuid().required().messages({
    "string.guid": "integration custom field header ID must be a valid UUID",
    "any.required": "integration custom field header ID is required",
  }),
});

const updateIntegrationCustomFieldHeaderParamsSchema = Joi.object({
  integration_custom_field_header_id: Joi.string().uuid().required().messages({
    "string.guid": "integration custom field header ID must be a valid UUID",
    "any.required": "integration custom field header ID is required",
  }),
});

const updateIntegrationCustomFieldHeaderSchem = Joi.object({
  header_name: Joi.string().trim().max(150).optional(),
  sort_order: Joi.number().integer().default(0).min(0).optional(),
});

const updateIntegrationCustomFieldHeaderIsActiveSchema = Joi.object({
  is_active: Joi.boolean().required(),
});
module.exports = {
  createIntegrationCustomFieldHeaderSchema,
  getAllIntegrationCustomFieldHeaderSchema,
  deleteIntegrationCustomFieldHeaderSchema,
  updateIntegrationCustomFieldHeaderParamsSchema,
  updateIntegrationCustomFieldHeaderSchem,
  updateIntegrationCustomFieldHeaderIsActiveSchema,
};
