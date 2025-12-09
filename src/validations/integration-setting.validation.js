const Joi = require("joi");

const createIntegrationSettingsSchema = Joi.object({
  automatically_send_welcome_email: Joi.boolean().optional(),
  rea_hl_enabled: Joi.boolean().optional(),
  canibuild_enabled: Joi.boolean().optional(),
  website_hl_enabled: Joi.boolean().optional(),
  google_enabled: Joi.boolean().optional(),

  assign_leads_if_assignee_not_found: Joi.string()
    .uuid()
    .allow(null)
    .optional()
    .messages({
      "string.guid": "assign_leads_if_assignee_not_found must be a valid UUID.",
    }),

  always_assign_leads_to: Joi.string().uuid().allow(null).optional().messages({
    "string.guid": "always_assign_leads_to must be a valid UUID.",
  }),
});

const updateIntegrationSettingParamsSchema = Joi.object({
  integration_settings_id: Joi.string().uuid().required().messages({
    "string.guid": "Integration setting id must be a valid UUID",
    "any.required": "Integratiob setting id is required",
  }),
});

const updateIntegrationSettingSchema = Joi.object({
  automatically_send_welcome_email: Joi.boolean().optional(),
  rea_hl_enabled: Joi.boolean().optional(),
  canibuild_enabled: Joi.boolean().optional(),
  website_hl_enabled: Joi.boolean().optional(),
  google_enabled: Joi.boolean().optional(),

  assign_leads_if_assignee_not_found: Joi.string()
    .uuid()
    .allow(null)
    .optional()
    .messages({
      "string.guid": "assign_leads_if_assignee_not_found must be a valid UUID.",
    }),

  always_assign_leads_to: Joi.string().uuid().allow(null).optional().messages({
    "string.guid": "always_assign_leads_to must be a valid UUID.",
  }),
});

module.exports = {
  createIntegrationSettingsSchema,
  updateIntegrationSettingParamsSchema,
  updateIntegrationSettingSchema,
};
