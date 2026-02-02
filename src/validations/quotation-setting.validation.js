const Joi = require("joi");

const createQuotationSettingSchems = Joi.object({
  allow_save_as_new_version: Joi.boolean().default(false),
  mandatory_contact_details: Joi.boolean().default(false),
  mandatory_dwelling_type: Joi.boolean().default(false),
  mandatory_sketch_number: Joi.boolean().default(false),
  mandatory_land_title: Joi.boolean().default(false),
  enable_dwelling_size: Joi.boolean().default(false),
  enable_builder_cost: Joi.boolean().default(false),
  allow_notes: Joi.boolean().default(true),
  allow_cost_adjustment: Joi.boolean().default(false),
  show_notes_by_default: Joi.boolean().default(false),
  allow_multiple_packages: Joi.boolean().default(false),
  include_additional_items_in_price_adjusted_list: Joi.boolean().default(false),
  auto_approve_on_sales_won: Joi.boolean().default(false),
  show_default_pricelist_in_additional_items: Joi.boolean().default(false),
  hide_price_to_customer: Joi.boolean().default(false),
  enable_estimated_price_range: Joi.boolean().default(false),
  quotation_validity_days: Joi.number()
    .integer()
    .min(1)
    .max(365)
    .default(30)
    .optional(),
  extend_validity_from_updated_date: Joi.number()
    .integer()
    .min(1)
    .max(365)
    .default(0)
    .optional(),
  rename_send_for_approval_button: Joi.string()
    .trim()
    .min(2)
    .max(150)
    .pattern(/^(?=.*[a-zA-Z])[a-zA-Z0-9\s,./#-]+$/)
    .optional(),
  default_pricelist_id: Joi.string().uuid().optional().messages({
    "string.guid": "price list ID must be a valid UUID",
  }),
});

const updateQuotationSettingParamsSchema = Joi.object({
  quotation_settings_id: Joi.string().uuid().required().messages({
    "string.guid": "quotation setting ID must be a valid UUID",
    "any.required": "quotation setting ID is required",
  }),
});

const updateQuotationSettingSchema = Joi.object({
  allow_save_as_new_version: Joi.boolean().optional(),
  mandatory_contact_details: Joi.boolean().optional(),
  mandatory_dwelling_type: Joi.boolean().optional(),
  mandatory_sketch_number: Joi.boolean().optional(),
  mandatory_land_title: Joi.boolean().optional(),
  enable_dwelling_size: Joi.boolean().optional(),
  enable_builder_cost: Joi.boolean().optional(),
  allow_notes: Joi.boolean().optional(),
  allow_cost_adjustment: Joi.boolean().optional(),
  show_notes_by_default: Joi.boolean().optional(),
  allow_multiple_packages: Joi.boolean().optional(),
  include_additional_items_in_price_adjusted_list: Joi.boolean().optional(),
  auto_approve_on_sales_won: Joi.boolean().optional(),
  show_default_pricelist_in_additional_items: Joi.boolean().optional(),
  hide_price_to_customer: Joi.boolean().optional(),
  enable_estimated_price_range: Joi.boolean().optional(),
  quotation_validity_days: Joi.number()
    .integer()
    .min(1)
    .max(365)
    .default(30)
    .optional(),
  extend_validity_from_updated_date: Joi.number()
    .integer()
    .min(1)
    .max(365)
    .default(0)
    .optional(),
  rename_send_for_approval_button: Joi.string()
    .allow("", null)
    .trim()
    .max(150)
    .pattern(/^(?=.*[a-zA-Z])[a-zA-Z0-9\s,./#-]+$/)
    .optional(),
  default_pricelist_id: Joi.string().uuid().optional().messages({
    "string.guid": "price list ID must be a valid UUID",
  }),
});

module.exports = {
  createQuotationSettingSchems,
  updateQuotationSettingParamsSchema,
  updateQuotationSettingSchema,
};
