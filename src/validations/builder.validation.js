const Joi = require("joi");

const addressSchema = Joi.object({
  address_line1: Joi.string().max(255).required(),
  address_line2: Joi.string().max(255).allow(null, ""),
  city: Joi.string().max(100).allow(null, ""),
  state_id: Joi.string().uuid().allow(null),
  country_id: Joi.string().uuid().allow(null),
  zip_code: Joi.string().max(20).allow(null, ""),
});

const insurerSchema = Joi.object({
  insurer_name: Joi.string().max(150).required(),
  insured_name: Joi.string().max(150).allow(null, ""),
  phone_number: Joi.string().max(50).allow(null, ""),
  address_line1: Joi.string().max(255).allow(null, ""),
  address_line2: Joi.string().max(255).allow(null, ""),
  state_id: Joi.string().uuid().allow(null),
  country_id: Joi.string().uuid().allow(null),
  zip_code: Joi.string().max(20).allow(null, ""),
});

const upsertBuilderSchema = Joi.object({
  company_id: Joi.string().uuid(),
  name: Joi.string().max(150),
  email: Joi.string().email().allow(null, ""),
  phone_number: Joi.string().max(50).allow(null, ""),
  abn_number: Joi.string().max(20).allow(null, ""),
  acn_number: Joi.string().max(20).allow(null, ""),
  hia_membership_no: Joi.string().max(100).allow(null, ""),
  registration_number: Joi.string().max(100).allow(null, ""),
  registered_building_practitioner: Joi.boolean(),
  practitioner_reg_no: Joi.string().max(100).allow(null, ""),
  licensed_builder_name: Joi.string().max(150).allow(null, ""),
  bank_name: Joi.string().max(150).allow(null, ""),
  account_name: Joi.string().max(150).allow(null, ""),
  account_number: Joi.string().max(50).allow(null, ""),
  account_bsb: Joi.string().max(20).allow(null, ""),
  address: addressSchema.optional(),
  insurer: insurerSchema.optional(),
})
.min(1);

module.exports = { upsertBuilderSchema };
