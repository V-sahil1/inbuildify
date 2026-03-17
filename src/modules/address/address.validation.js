import Joi from "joi";

export const createAddressSchema = Joi.object({
  country_id: Joi.string().uuid().allow(null).optional(),
  state_id: Joi.string().uuid().allow(null).optional(),
  address_line1: Joi.string()
    .min(2)
    .max(255)
    .pattern(/^(?=.*[a-zA-Z])[a-zA-Z0-9\s,./#-]+$/)
    .required()
    .messages({
      "any.required": "Address Line 1 is required",
    }),

  address_line2: Joi.string()
    .min(2)
    .max(255)
    .pattern(/^(?=.*[a-zA-Z])[a-zA-Z0-9\s,./#-]+$/)
    .allow(null, "")
    .optional(),
  city: Joi.string().max(100).allow(null, "").optional(),
  zip_code: Joi.string()
    .optional()
    .pattern(/^\d{4}$/)
    .min(4)
    .max(4),
});

export default { createAddressSchema };
