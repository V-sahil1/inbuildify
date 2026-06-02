import Joi from "joi";

const passwordRule = Joi.string().min(6).max(100).required().messages({
  "string.base": "Password must be a string",
  "string.empty": "Password is required",
  "string.min": "Password must be at least 6 characters long",
  "string.max": "Password must not exceed 100 characters",
  "any.required": "Password is required",
});

const emailRule = Joi.string().email().lowercase().trim().required().messages({
  "string.base": "Email must be a string",
  "string.empty": "Email is required",
  "string.email": "Please provide a valid email address",
  "any.required": "Email is required",
});

export const companySignUpSchema = Joi.object({
  company_name: Joi.string().min(2).max(150).trim().required().messages({
    "string.empty": "Company name is required",
    "string.min": "Company name must be at least 2 characters long",
    "string.max": "Company name must not exceed 150 characters",
    "any.required": "Company name is required",
  }),
  email: emailRule,
  password: passwordRule,
  role_id: Joi.string().uuid().required().messages({
    "string.guid": "role ID must be a valid UUID",
    "any.required": "role ID is required",
  }),
});

export const companyOnboardingParamsSchema = Joi.object({
  id: Joi.string().uuid().required().messages({
    "string.guid": "Company ID must be a valid UUID",
    "any.required": "Company ID is required",
  }),
});

const addressSchema = Joi.object({
  address_line1: Joi.string()
    .trim()
    .min(10)
    .max(255)
    .pattern(/^(?=.*[a-zA-Z])[a-zA-Z0-9\s,./#-]+$/)
    .required()
    .messages({
      "string.pattern.base": "Address line 1 must contain at least one letter",
      "any.required": "Address line 1 is required",
      "string.min": "Address line 1 must be at least 10 characters long",
      "string.max": "Address line 1 must not exceed 255 characters",
    }),
  address_line2: Joi.string()
    .trim()
    .min(2)
    .max(255)
    .allow(null, "")
    .pattern(/^(?=.*[a-zA-Z])[a-zA-Z0-9\s,./#-]+$/)
    .optional()
    .messages({
      "string.pattern.base": "Address line 2 must contain at least one letter",
      "string.min": "Address line 2 must be at least 2 characters long",
      "string.max": "Address line 2 must not exceed 255 characters",
    }),
  city: Joi.string()
    .trim()
    .min(2)
    .max(100)
    .pattern(/^(?=.*[A-Za-z])[A-Za-z\s.-]+$/)
    .required()
    .messages({
      "any.required": "City is required",
      "string.empty": "City cannot be empty",
      "string.min": "City must be at least 2 characters long",
      "string.max": "City must not exceed 100 characters",
      "string.pattern.base":
        "City must contain only letters and valid characters (space, dot, hyphen)",
    }),
  zip_code: Joi.string().trim().min(4).max(4).required().messages({
    "any.required": "Zip code is required",
    "string.max": "Zip code must not exceed 4 characters",
    "string.min": "Zip code must be at least 4 characters long",
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

export const companyOnboardingBodySchema = Joi.object({
  name: Joi.string().min(2).max(150).trim().optional().messages({
    "string.min": "Company name must be at least 2 characters long",
    "string.max": "Company name must not exceed 150 characters",
  }),
  company_logo: Joi.string().max(500).optional().allow(null, ""),
  email_signature_logo: Joi.string().max(500).optional().allow(null, ""),
  abn_number: Joi.string().min(11).max(11).optional().allow(null, "").messages({
    "string.min": "ABN number must be 11 characters",
    "string.max": "ABN number must be 11 characters",
  }),
  timezone_id: Joi.string().uuid().optional().allow(null, "").messages({
    "string.guid": "timezone ID must be a valid UUID",
  }),
  address: addressSchema.optional().messages({
    "any.required": "Address is required",
  }),
  website: Joi.string().trim().uri().optional().allow(null, ""),

}).unknown(true);

export default {
  companySignUpSchema,
  companyOnboardingParamsSchema,
  companyOnboardingBodySchema,
};
