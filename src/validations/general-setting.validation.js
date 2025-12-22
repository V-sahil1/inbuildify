const Joi = require("joi");

const allowedShowReferenceValues = [
  "document_id",
  "job_id",
  "document_id_and_job_id",
  "hide_document_id_and_job_id",
];

const createGeneralSettigSchema = Joi.object({
  notification_referral_partner: Joi.boolean().optional().default(false),
  pdf_password_protected: Joi.boolean().optional().default(false),

  pdf_password: Joi.when("pdf_password_protected", {
    is: true,
    then: Joi.string().trim().min(3).max(255).required().messages({
      "any.required":
        "PDF password is required when password protection is enabled.",
      "string.empty": "PDF password cannot be empty.",
    }),
    otherwise: Joi.string().allow(null, "").optional(),
  }),

  round_of_cost: Joi.boolean().optional().default(false),
  negative_value_show: Joi.boolean().optional().default(true),
  negative_value_color: Joi.string()
    .trim()
    .pattern(/^#([0-9A-F]{3}|[0-9A-F]{6})$/i)
    .optional()
    .allow(null)
    .messages({
      "string.pattern.base":
        "Enter valid font color in HEX format (e.g., #FFF453)",
    }),

  show_reference_id_in_pdf: Joi.string()
    .valid(...allowedShowReferenceValues)
    .default("hide_document_id_and_job_id")
    .messages({
      "any.only": `show_reference_id_in_pdf must be one of: ${allowedShowReferenceValues.join(
        ", "
      )}`,
    }),

  job_id_label: Joi.string().max(100).allow(null, "").optional(),
});

const getAllGeneralSettingSchema = Joi.object({
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

const updateGeneralSettingIdParamsSchema = Joi.object({
  id: Joi.string().uuid().required().messages({
    "string.guid": "ID must be a valid UUID",
    "any.required": "ID is required",
  }),
});

const updateGeneralSettingsSchema = Joi.object({
  notification_referral_partner: Joi.boolean().optional().default(false),
  pdf_password_protected: Joi.boolean().optional().default(false),

  pdf_password: Joi.optional().when("pdf_password_protected", {
    is: true,
    then: Joi.string().trim().min(3).max(255).required().messages({
      "any.required":
        "PDF password is required when password protection is enabled.",
      "string.empty": "PDF password cannot be empty.",
    }),
    otherwise: Joi.string().allow(null, "").optional(),
  }),

  round_of_cost: Joi.boolean().optional().default(false),
  negative_value_show: Joi.boolean().optional().default(true),
  negative_value_color: Joi.string()
    .trim()
    .pattern(/^#([0-9A-F]{3}|[0-9A-F]{6})$/i)
    .optional()
    .allow(null)
    .messages({
      "string.pattern.base":
        "Enter valid font color in HEX format (e.g., #FFF453)",
    }),

  show_reference_id_in_pdf: Joi.string()
    .valid(...allowedShowReferenceValues)
    .optional()
    .default("hide_document_id_and_job_id")
    .messages({
      "any.only": `show_reference_id_in_pdf must be one of: ${allowedShowReferenceValues.join(
        ", "
      )}`,
    }),

  job_id_label: Joi.string().max(100).allow(null, "").optional(),
});

module.exports = {
  createGeneralSettigSchema,
  updateGeneralSettingIdParamsSchema,
  updateGeneralSettingsSchema,
  getAllGeneralSettingSchema,
};
