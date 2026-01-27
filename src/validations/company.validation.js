const Joi = require("joi");

const addressSchema = Joi.object({
  address_line1: Joi.string().trim().max(255).required().messages({
    "any.required": "Address line 1 is required",
  }),
  address_line2: Joi.string().trim().optional(),
  city: Joi.string().trim().max(100).required().messages({
    "any.required": "City is required",
  }),
  zip_code: Joi.string().trim().max(20).required().messages({
    "any.required": "Zip code is required",
  }),
  state_id: Joi.string().uuid().required().messages({
    "string.guid": "State ID must be a valid UUID",
    "any.required": "State ID is required",
  }),
  country_id: Joi.string().uuid().required().messages({
    "string.guid": "Country ID must be a valid UUID",
    "any.required": "Country ID is required",
  }),
});

const upsertCompanySchema = Joi.object({
  name: Joi.string().max(150).required().messages({
    "any.required": "Company name is required",
  }),
  abn_number: Joi.string().max(20).allow(null, "").optional(),
  timezone_id: Joi.string().uuid().required().messages({
    "string.guid": "timezone ID must be a valid UUID",
    "any.required": "timezone ID is required",
  }),
  address: addressSchema.required().messages({
    "any.required": "Address is required",
  }),
  bank_name: Joi.string().max(150).allow(null, "").optional(),
  account_name: Joi.string().max(150).allow(null, "").optional(),
  account_number: Joi.string().max(50).allow(null, "").optional(),
  account_bsb: Joi.string().max(20).allow(null, "").optional(),
  email_signature_logo: Joi.string().max(500).allow(null, "").optional(),
  company_logo: Joi.string().max(500).allow(null, "").optional(),
});

module.exports = { upsertCompanySchema };
