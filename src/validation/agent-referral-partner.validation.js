const Joi = require("joi");

const createAgentReferralPartnerSchema = Joi.object({
  address: Joi.object({
    address_line1: Joi.string().max(255).allow(""),
    address_line2: Joi.string().max(255).allow(null),
    city: Joi.string().max(100).allow(""),
    state_id: Joi.string().uuid().allow(null),
    country_id: Joi.string().uuid().allow(null),
    zip_code: Joi.string().max(20).allow(""),
  }).optional(),
  user: Joi.object({
    name: Joi.string().min(2).max(255).required().messages({
      "string.empty": "Name is required.",
      "string.min": "Name must be at least 2 characters.",
      "string.max": "Name must not exceed 255 characters.",
      "any.required": "Name is required.",
    }),
    email: Joi.string().email().required().messages({
      "string.email": "Please provide a valid email address.",
      "any.required": "Email is required.",
    }),
    phone: Joi.string().min(5).max(20).required().messages({
      "string.empty": "Phone is required.",
      "string.min": "Phone must be at least 5 characters.",
      "string.max": "Phone must not exceed 20 characters.",
      "any.required": "Phone is required.",
    }),
    create_login: Joi.boolean().default(false),
    login_id: Joi.when("create_login", {
      is: true,
      then: Joi.string().min(3).max(100).required().messages({
        "string.empty": "Login ID is required when creating login credentials.",
        "string.min": "Login ID must be at least 3 characters.",
        "string.max": "Login ID must not exceed 100 characters.",
        "any.required": "Login ID is required when creating login credentials.",
      }),
      otherwise: Joi.forbidden().messages({
        "any.unknown":
          "Login ID cannot be provided when create_login is false.",
      }),
    }),
    password_option: Joi.when("create_login", {
      is: true,
      then: Joi.string().valid("manual", "auto"),
      otherwise: Joi.forbidden().messages({
        "any.unknown":
          "Password option cannot be provided when create_login is false.",
      }),
    }),
    manual_password: Joi.when("create_login", {
      is: true,
      then: Joi.when("password_option", {
        is: "manual",
        then: Joi.string().min(8).required().messages({
          "string.empty":
            "Manual password is required when password option is manual.",
          "string.min": "Password must be at least 8 characters.",
          "any.required":
            "Manual password is required when password option is manual.",
        }),
        otherwise: Joi.forbidden().messages({
          "any.unknown":
            "Manual password can only be provided when password option is manual.",
        }),
      }),
      otherwise: Joi.forbidden().messages({
        "any.unknown":
          "Manual password cannot be provided when create_login is false.",
      }),
    }),
    next_login_password_change: Joi.when("create_login", {
      is: true,
      then: Joi.boolean().default(false),
      otherwise: Joi.forbidden().messages({
        "any.unknown":
          "Next login password change cannot be provided when create_login is false.",
      }),
    }),
    email_login_credentials: Joi.when("create_login", {
      is: true,
      then: Joi.boolean().default(false),
      otherwise: Joi.forbidden().messages({
        "any.unknown":
          "Email login credentials cannot be provided when create_login is false.",
      }),
    }),
  }).required(),
  account_name: Joi.string().max(255).allow(null, ""),
  account_bsb: Joi.string().max(20).allow(null, ""),
  account_number: Joi.string().max(50).allow(null, ""),
  abn: Joi.string().max(50).allow(null, ""),
  company_name: Joi.string().max(255).allow(null, ""),
  referred_user_id: Joi.string().uuid().required().messages({
    "string.empty": "Referred user ID is required.",
    "string.uuid": "Referred user ID must be a valid UUID.",
    "any.required": "Referred user ID is required.",
  }),
});

const updateAgentReferralPartnerSchema = Joi.object({
  address: Joi.object({
    address_line1: Joi.string().max(255).allow(""),
    address_line2: Joi.string().max(255).allow(null),
    city: Joi.string().max(100).allow(""),
    state_id: Joi.string().uuid().allow(null),
    country_id: Joi.string().uuid().allow(null),
    zip_code: Joi.string().max(20).allow(""),
  }).optional(),
  user: Joi.object({
    name: Joi.string().min(2).max(255).required().messages({
      "string.empty": "Name is required.",
      "string.min": "Name must be at least 2 characters.",
      "string.max": "Name must not exceed 255 characters.",
      "any.required": "Name is required.",
    }),
    email: Joi.string().email().required().messages({
      "string.email": "Please provide a valid email address.",
      "any.required": "Email is required.",
    }),
    phone: Joi.string().min(5).max(20).required().messages({
      "string.empty": "Phone is required.",
      "string.min": "Phone must be at least 5 characters.",
      "string.max": "Phone must not exceed 20 characters.",
      "any.required": "Phone is required.",
    }),
    create_login: Joi.boolean().optional(),
    login_id: Joi.when("create_login", {
      is: true,
      then: Joi.string().min(3).max(100).required().messages({
        "string.empty": "Login ID is required when creating login credentials.",
        "string.min": "Login ID must be at least 3 characters.",
        "string.max": "Login ID must not exceed 100 characters.",
        "any.required": "Login ID is required when creating login credentials.",
      }),
      otherwise: Joi.forbidden().messages({
        "any.unknown":
          "Login ID cannot be provided when create_login is false.",
      }),
    }),
    password_option: Joi.when("create_login", {
      is: true,
      then: Joi.string().valid("manual", "auto").default("manual"),
      otherwise: Joi.forbidden().messages({
        "any.unknown":
          "Password option cannot be provided when create_login is false.",
      }),
    }),
    manual_password: Joi.when("create_login", {
      is: true,
      then: Joi.when("password_option", {
        is: "manual",
        then: Joi.string().min(8).optional(),
        otherwise: Joi.forbidden().messages({
          "any.unknown":
            "Manual password can only be provided when password option is manual.",
        }),
      }),
      otherwise: Joi.forbidden().messages({
        "any.unknown":
          "Manual password cannot be provided when create_login is false.",
      }),
    }),
    next_login_password_change: Joi.when("create_login", {
      is: true,
      then: Joi.boolean().optional(),
      otherwise: Joi.forbidden().messages({
        "any.unknown":
          "Next login password change cannot be provided when create_login is false.",
      }),
    }),
    email_login_credentials: Joi.when("create_login", {
      is: true,
      then: Joi.boolean().optional(),
      otherwise: Joi.forbidden().messages({
        "any.unknown":
          "Email login credentials cannot be provided when create_login is false.",
      }),
    }),
  }).required(),
  account_name: Joi.string().max(255).allow(null, ""),
  account_bsb: Joi.string().max(20).allow(null, ""),
  account_number: Joi.string().max(50).allow(null, ""),
  abn: Joi.string().max(50).allow(null, ""),
  company_name: Joi.string().max(255).allow(null, ""),
  referred_user_id: Joi.string().uuid().allow(null),
});

module.exports = {
  createAgentReferralPartnerSchema,
  updateAgentReferralPartnerSchema,
};
