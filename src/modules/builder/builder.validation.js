import Joi from "joi";

const addressSchema = Joi.object({
  address_line1: Joi.string()
    .min(2)
    .max(255)
    .pattern(/^(?=.*[a-zA-Z])[a-zA-Z0-9\s,./#-]+$/)
    .optional()
    .messages({
      "string.pattern.base": "Address line 1 must contain at least one letter",
      "string.min": "Address line 1 must be at least 2 characters long",
      "string.max": "Address line 1 must not exceed 255 characters",
    }),
  address_line2: Joi.string()
    .min(2)
    .max(255)
    .pattern(/^(?=.*[a-zA-Z])[a-zA-Z0-9\s,./#-]+$/)
    .optional()
    .messages({
      "string.pattern.base": "Address line 2 must contain at least one letter",
      "string.min": "Address line 2 must be at least 2 characters long",
      "string.max": "Address line 2 must not exceed 255 characters",
    }),
  city: Joi.string()
    .min(2)
    .max(100)
    .pattern(/^(?=.*[a-zA-Z])[a-zA-Z0-9\s,./#-]+$/)
    .optional()
    .messages({
      "string.min": "City must be at least 2 characters long",
      "string.max": "City must not exceed 100 characters",
      "string.pattern.base": "City must contain at least one letter",
    }),
  country_id: Joi.string().uuid().optional().allow(null),
  state_id: Joi.string().uuid().optional().allow(null),
  zip_code: Joi.string().min(4).max(4).optional().messages({
    "string.min": "Zip code must be at least 4 characters long",
    "string.max": "Zip code must not exceed 4 characters",
  }),
});

const insurerSchema = Joi.object({
  insurer_name: Joi.string()
    .min(2)
    .max(150)
    .pattern(/^(?=.*[a-zA-Z])[a-zA-Z0-9\s,./#-]+$/)
    .optional()
    .messages({
      "string.pattern.base": "Insurer name must contain at least one letter",
      "string.min": "Insurer name must be at least 2 characters long",
      "string.max": "Insurer name must not exceed 150 characters",
    }),
  insured_name: Joi.string()
    .min(2)
    .max(150)
    .pattern(/^(?=.*[a-zA-Z])[a-zA-Z0-9\s,./#-]+$/)
    .optional()
    .messages({
      "string.pattern.base": "Insured name must contain at least one letter",
      "string.max": "Insured name must not exceed 150 characters",
    }),
  phone_number: Joi.string()
    .pattern(/^[0-9]+$/)
    .min(10)
    .max(14)
    .optional()
    .allow(null, "")
    .messages({
      "string.pattern.base": "Phone number must contain only digits",
      "string.min": "Phone number must be at least 10 digits long",
      "string.max": "Phone number must not exceed 14 digits long",
    }),
  address_line1: Joi.string()
    .min(2)
    .max(255)
    .pattern(/^(?=.*[a-zA-Z])[a-zA-Z0-9\s,./#-]+$/)
    .optional()
    .messages({
      "string.pattern.base": "Address line 1 must contain at least one letter",
      "string.min": "Address line 1 must be at least 2 characters long",
      "string.max": "Address line 1 must not exceed 255 characters",
    }),
  address_line2: Joi.string()
    .min(2)
    .max(255)
    .pattern(/^(?=.*[a-zA-Z])[a-zA-Z0-9\s,./#-]+$/)
    .optional()
    .messages({
      "string.pattern.base": "Address line 2 must contain at least one letter",
      "string.min": "Address line 2 must be at least 2 characters long",
      "string.max": "Address line 2 must not exceed 255 characters",
    }),
  state_id: Joi.string().uuid().allow(null),
  zip_code: Joi.string().min(4).max(4).optional().messages({
    "string.min": "Zip code must be at least 4 characters long",
    "string.max": "Zip code must not exceed 4 characters",
  }),
});

export const upsertBuilderSchema = Joi.object({
  company_id: Joi.string().uuid().messages({
    "string.guid": "Company ID must be a valid UUID",
    "any.required": "Company ID is required",
  }),
  name: Joi.string()
    .min(2)
    .max(150)
    .pattern(/^(?=.*[a-zA-Z])[a-zA-Z0-9\s,./#-]+$/)
    .messages({
      "string.pattern.base": "Name must contain at least one letter",
      "string.min": "Name must be at least 2 characters long",
      "string.max": "Name must not exceed 150 characters",
    }),
  email: Joi.string().email().optional(),
  phone_number: Joi.string()
    .pattern(/^[0-9]+$/)
    .min(10)
    .max(14)
    .optional()
    .allow(null, "")
    .messages({
      "string.pattern.base": "Phone number must contain only digits",
      "string.min": "Phone number must be at least 10 digits long",
      "string.max": "Phone number must not exceed 14 digits long",
    }),
  abn_number: Joi.string().min(11).max(11).optional().allow(null, "").messages({
    "string.min": "ABN number must be at least 11 characters long",
    "string.max": "ABN number must not exceed 11 characters",
  }),
  acn_number: Joi.string().min(9).max(9).optional().allow(null, "").messages({
    "string.min": "ACN number must be at least 9 characters long",
    "string.max": "ACN number must not exceed 9 characters",
  }),
  hia_membership_no: Joi.string().min(2).max(100).allow(null, ""),
  registration_number: Joi.string().min(10).max(100).optional().allow(null, "").messages({
    "string.min": "Registration number must be at least 10 characters long",
    "string.max": "Registration number must not exceed 100 characters",
  }),
 registered_building_practitioner: Joi.string().min(2).max(255).allow(null, "").messages({
    "string.min": "Registered building practitioner must be at least 2 characters long",
    "string.max": "Registered building practitioner must not exceed 255 characters",
  }),
  practitioner_reg_no: Joi.string().min(2).max(100).allow(null, "").messages({
    "string.min": "Practitioner registration number must be at least 2 characters long",
    "string.max": "Practitioner registration number must not exceed 100 characters",
  }),
  licensed_builder_name: Joi.string()
    .min(2)
    .max(150)
    .pattern(/^(?=.*[a-zA-Z])[a-zA-Z0-9\s,./#-]+$/)
    .optional()
    .messages({
      "string.pattern.base":
        "Licensed builder name must contain at least one letter",
      "string.min": "Licensed builder name must be at least 2 characters long",
      "string.max": "Licensed builder name must not exceed 150 characters",
    }),
  bank_name: Joi.string()
    .min(2)
    .max(150)
    .pattern(/^(?=.*[a-zA-Z])[a-zA-Z0-9\s,./#-]+$/)
    .optional()
    .messages({
      "string.pattern.base": "Bank name must contain at least one letter",
      "string.min": "Bank name must be at least 2 characters long",
      "string.max": "Bank name must not exceed 150 characters",
    }),
  account_name: Joi.string()
    .min(2)
    .max(150)
    .pattern(/^(?=.*[a-zA-Z])[a-zA-Z0-9\s,./#-]+$/)
    .optional()
    .messages({
      "string.pattern.base": "Account name must contain at least one letter",
      "string.min": "Account name must be at least 2 characters long",
      "string.max": "Account name must not exceed 150 characters",
    }),
  account_number: Joi.string().min(6).max(10).optional().messages({
    "string.min": "Account number must be at least 6 characters long",
    "string.max": "Account number must not exceed 10 characters",
  }),
  account_bsb: Joi.string().min(6).max(6).optional().messages({
    "string.min": "Account BSB must be at least 6 characters long",
    "string.max": "Account BSB must not exceed 6 characters",
  }),
  logo: Joi.string().allow(null, ""),
  address: addressSchema.optional(),
  insurer: insurerSchema.optional(),
}).min(1);

export default { upsertBuilderSchema };
