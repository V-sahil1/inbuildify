const Joi = require("joi");

const createCompanySchema = Joi.object({
  name: Joi.string().max(150).required().messages({
    "any.required": "Company name is required",
  }),
  abn_number: Joi.string().max(20).allow(null, "").optional(),
  timezone: Joi.string().max(100).allow(null, "").optional(),
  address_id: Joi.string().uuid().allow(null).optional(),
  bank_name: Joi.string().max(150).allow(null, "").optional(),
  account_name: Joi.string().max(150).allow(null, "").optional(),
  account_number: Joi.string().max(50).allow(null, "").optional(),
  account_bsb: Joi.string().max(20).allow(null, "").optional(),
  emailSignatureLogoImage: Joi.string().max(500).allow(null, "").optional(),
  companyLogoImage: Joi.string().max(500).allow(null, "").optional(),
});

module.exports = { createCompanySchema };
