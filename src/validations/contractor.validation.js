const Joi = require('joi');

const createContractorSchema = Joi.object({
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
  phone: Joi.string().pattern(/^[0-9]{10,15}$/).required().messages({
    'string.base': 'Phone must be a string',
    'string.pattern.base': 'Phone must contain only digits and be 10-15 characters long',
    'any.required': 'Phone is required'
  }),
  address: Joi.string().min(10).max(500).required().trim().messages({
    'string.base': 'Address must be a string',
    'string.empty': 'Address is required',
    'string.min': 'Address must be at least 10 characters long',
    'string.max': 'Address must not exceed 500 characters',
    'any.required': 'Address is required'
  }),
  builderId: Joi.string().uuid().required().messages({
    'string.base': 'Builder ID must be a string',
    'string.empty': 'Builder ID is required',
    'string.pattern.base': 'Builder ID must be a valid numeric ID',
    'any.required': 'Builder ID is required'
  }),
});

module.exports = {
  createContractorSchema
};