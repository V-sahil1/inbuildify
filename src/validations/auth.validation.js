const Joi = require("joi");

// Reusable rules
const nameRule = Joi.string().min(2).max(100).trim().required().messages({
  "string.base": "Name must be a string",
  "string.empty": "Name is required",
  "string.min": "Name must be at least 2 characters long",
  "string.max": "Name must not exceed 100 characters",
  "any.required": "Name is required",
});

const emailRule = Joi.string().email().lowercase().trim().required().messages({
  "string.base": "Email must be a string",
  "string.empty": "Email is required",
  "string.email": "Please provide a valid email address",
  "any.required": "Email is required",
});

const passwordRule = Joi.string().min(6).max(100).required().messages({
  "string.base": "Password must be a string",
  "string.empty": "Password is required",
  "string.min": "Password must be at least 6 characters long",
  "string.max": "Password must not exceed 100 characters",
  "any.required": "Password is required",
});

const otpRule = Joi.string()
  .length(6)
  .pattern(/^[0-9]+$/)
  .required()
  .messages({
    "string.base": "OTP must be a string",
    "string.empty": "OTP is required",
    "string.length": "OTP must be exactly 6 digits",
    "string.pattern.base": "OTP must contain only numbers",
    "any.required": "OTP is required",
  });

const phoneRule = Joi.string()
  .pattern(/^[0-9]{10,15}$/)
  .optional()
  .allow("")
  .messages({
    "string.base": "Phone must be a string",
    "string.pattern.base":
      "Phone must contain only digits and be 10-15 characters long",
  });

// Schemas
const registerRootSchema = Joi.object({
  name: nameRule,
  email: emailRule,
  password: passwordRule,
  role_id: Joi.string().uuid().required().messages({
    "string.guid": "role ID must be a valid UUID",
    "any.required": "role ID is required",
  }),
  phone: phoneRule,
});

const loginUserSchema = Joi.object({
  email: Joi.string().email().lowercase().trim().optional().allow("").messages({
    "string.base": "Email must be a string",
    "string.email": "Please provide a valid email address",
  }),
  login_id: Joi.string().min(2).max(100).trim().optional().allow("").messages({
    "string.base": "Login ID must be a string",
    "string.min": "Login ID must be at least 2 characters long",
    "string.max": "Login ID must not exceed 100 characters",
  }),
  password: Joi.string().required().messages({
    "string.base": "Password must be a string",
    "string.empty": "Password is required",
    "any.required": "Password is required",
  }),
})
  .or("email", "login_id")
  .messages({
    "object.missing": "Either email or login ID is required",
  });

const verifyEmailSchema = Joi.object({
  email: emailRule,
  otp: otpRule,
});

const forgotPasswordSchema = Joi.object({
  email: emailRule,
});

const resetPasswordSchema = Joi.object({
  email: emailRule,
  resetPasswordToken: Joi.string().allow("").messages({
    "string.base": "Reset password token must be a string",
    "string.empty": "Reset password token is not empty",
    "any.required": "Reset password token is required",
  }),
  password: passwordRule.label("New password"), // override label for better messages
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required().messages({
    "string.base": "Current password must be a string",
    "string.empty": "Current password is required",
    "any.required": "Current password is required",
  }),
  newPassword: passwordRule.label("New password"),
});

const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required().messages({
    "string.base": "Refresh token must be a string",
    "string.empty": "Refresh token is required",
    "any.required": "Refresh token is required",
  }),
});

const resendOtpSchema = Joi.object({
  email: emailRule,
});

module.exports = {
  registerRootSchema,
  loginUserSchema,
  verifyEmailSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  refreshTokenSchema,
  resendOtpSchema,
};
