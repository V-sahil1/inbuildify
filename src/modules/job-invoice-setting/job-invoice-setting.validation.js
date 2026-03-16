import Joi from "joi";

const createJobInvocieSettingSchema = Joi.object({
  show_invoice_summary_in_pdf: Joi.boolean().default(false),
  invoice_terms_days: Joi.number().integer().min(0).default(0),
});

const updateJobInvoiceSettingParamsSchema = Joi.object({
  id: Joi.string().uuid().required().messages({
    "string.guid": "Surveyor ID must be a valid UUID",
    "any.required": "Surveyor ID is required",
  }),
});

const updateJobInvoiceSettingSchema = Joi.object({
  show_invoice_summary_in_pdf: Joi.boolean().default(false),
  invoice_terms_days: Joi.number().integer().min(0).optional(),
});

export default {
  createJobInvocieSettingSchema,
  updateJobInvoiceSettingParamsSchema,
  updateJobInvoiceSettingSchema,
};
