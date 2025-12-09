const Joi = require("joi");

const createAddressSchema = Joi.object({
  country_id: Joi.string().uuid().allow(null).optional(),
  state_id: Joi.string().uuid().allow(null).optional(),
  address_line1: Joi.string().max(255).required().messages({
    "any.required": "Address Line 1 is required",
  }),

  address_line2: Joi.string().max(255).allow(null, "").optional(),
  city: Joi.string().max(100).allow(null, "").optional(),
  zip_code: Joi.string()
    .optional()
    .pattern(/^\d{4}$/)
    .min(4)
    .max(4),
});

module.exports = { createAddressSchema };
