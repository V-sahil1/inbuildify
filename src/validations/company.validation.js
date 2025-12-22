const Joi = require("joi");

const createCompanySchema = Joi.object({
  name: Joi.string().max(150).required().messages({
    "any.required": "Company name is required",
  }),
  abn_number: Joi.string().max(20).allow(null, "").optional(),
  timezone_id: Joi.string().uuid().required().messages({
    "string.guid": "timezone ID must be a valid UUID",
    "any.required": "timezone ID is required",
  }),
  address1: Joi.string().trim().max(255).required(),
  address2: Joi.string().trim().optional(),
  city: Joi.string().trim().max(255).required(),
  zip_postal_code: Joi.string().trim().max(20).required(),
  state_id: Joi.string().uuid().required().messages({
    "string.guid": "state ID must be a valid UUID",
    "any.required": "state ID is required",
  }),
  country_id: Joi.string().uuid().required().messages({
    "string.guid": "state ID must be a valid UUID",
    "any.required": "state ID is required",
  }),
  bank_name: Joi.string().max(150).allow(null, "").optional(),
  account_name: Joi.string().max(150).allow(null, "").optional(),
  account_number: Joi.string().max(50).allow(null, "").optional(),
  account_bsb: Joi.string().max(20).allow(null, "").optional(),
  email_signature_logo: Joi.string().max(500).allow(null, "").optional(),
  company_logo: Joi.string().max(500).allow(null, "").optional(),
});

module.exports = { createCompanySchema };
