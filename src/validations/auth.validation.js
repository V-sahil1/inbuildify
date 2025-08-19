const Joi = require('joi');

const createUserSchema = Joi.object({
  name: Joi.string().min(2).max(100).required().trim().messages({
    'string.base': 'Name must be a string',
    'string.empty': 'Name is required',
    'string.min': 'Name must be at least 2 characters long',
    'string.max': 'Name must not exceed 100 characters',
    'any.required': 'Name is required'
  }),
  email: Joi.string().email().required().lowercase().trim().messages({
    'string.base': 'Email must be a string',
    'string.empty': 'Email is required',
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required'
  }),
  password: Joi.string().min(6).max(100).required().messages({
    'string.base': 'Password must be a string',
    'string.empty': 'Password is required',
    'string.min': 'Password must be at least 6 characters long',
    'string.max': 'Password must not exceed 100 characters',
    'any.required': 'Password is required'
  }),
  role: Joi.string().valid('super_admin', 'admin', 'project_owner', 'service_provider', 'client').default('client').messages({
    'string.base': 'Role must be a string',
    'any.only': 'Role must be one of: admin, user, builder, contractor'
  }),
  phone: Joi.string().pattern(/^[0-9]{10,15}$/).optional().allow('').messages({
    'string.base': 'Phone must be a string',
    'string.pattern.base': 'Phone must contain only digits and be 10-15 characters long'
  })
});

const loginUserSchema = Joi.object({
  email: Joi.string().email().required().lowercase().trim().messages({
    'string.base': 'Email must be a string',
    'string.empty': 'Email is required',
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required'
  }),
  password: Joi.string().required().messages({
    'string.base': 'Password must be a string',
    'string.empty': 'Password is required',
    'any.required': 'Password is required'
  })
});

// Additional validation schemas you might need
const verifyEmailSchema = Joi.object({
  email: Joi.string().email().required().lowercase().trim().messages({
    'string.base': 'Email must be a string',
    'string.empty': 'Email is required',
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required'
  }),
  otp: Joi.string().length(6).pattern(/^[0-9]+$/).required().messages({
    'string.base': 'OTP must be a string',
    'string.empty': 'OTP is required',
    'string.length': 'OTP must be exactly 6 digits',
    'string.pattern.base': 'OTP must contain only numbers',
    'any.required': 'OTP is required'
  })
});

const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required().lowercase().trim().messages({
    'string.base': 'Email must be a string',
    'string.empty': 'Email is required',
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required'
  })
});

const resetPasswordSchema = Joi.object({
  email: Joi.string().email().required().lowercase().trim().messages({
    'string.base': 'Email must be a string',
    'string.empty': 'Email is required',
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required'
  }),
  otp: Joi.string().length(6).pattern(/^[0-9]+$/).required().messages({
    'string.base': 'OTP must be a string',
    'string.empty': 'OTP is required',
    'string.length': 'OTP must be exactly 6 digits',
    'string.pattern.base': 'OTP must contain only numbers',
    'any.required': 'OTP is required'
  }),
  newPassword: Joi.string().min(6).max(100).required().messages({
    'string.base': 'New password must be a string',
    'string.empty': 'New password is required',
    'string.min': 'New password must be at least 6 characters long',
    'string.max': 'New password must not exceed 100 characters',
    'any.required': 'New password is required'
  })
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required().messages({
    'string.base': 'Current password must be a string',
    'string.empty': 'Current password is required',
    'any.required': 'Current password is required'
  }),
  newPassword: Joi.string().min(6).max(100).required().messages({
    'string.base': 'New password must be a string',
    'string.empty': 'New password is required',
    'string.min': 'New password must be at least 6 characters long',
    'string.max': 'New password must not exceed 100 characters',
    'any.required': 'New password is required'
  })
});

module.exports = {
  createUserSchema,
  loginUserSchema,
  verifyEmailSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema
};
