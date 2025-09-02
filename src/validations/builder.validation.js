const Joi = require("joi");

const imageRule = Joi.alternatives().try(
  Joi.string().uri().max(500).trim().messages({
    'string.base': 'Image must be a string',
    'string.uri': 'Image must be a valid URL',
    'string.max': 'Image URL must not exceed 500 characters'
  }),
  Joi.object({
    fieldname: Joi.string().valid('image').required(),
    originalname: Joi.string().required(),
    mimetype: Joi.string().required(),
    size: Joi.number().max(10 * 1024 * 1024).required(),
    location: Joi.string().uri().required()
  }).unknown(true)
).optional();

const updateBuilderSchema = Joi.object({
  name: Joi.string().optional().messages({
    'string.base': 'Name must be a string',
    'string.empty': 'Name is required',
    'any.required': 'Name is required'
  }),
  phone: Joi.string().pattern(/^[0-9]{10,15}$/).optional().allow("").messages({
    'string.base': 'Phone number must be a string',
    'string.empty': 'Phone number is required',
    'any.required': 'Phone number is required',
    'string.pattern.base': 'Phone number must be a valid phone number'
  }),
  slogan: Joi.string().optional().messages({
    'string.base': 'Slogan must be a string',
    'string.empty': 'Slogan is required',
    'any.required': 'Slogan is required'
  }),
  firm_name: Joi.string().optional().messages({
    'string.base': 'Firm name must be a string',
    'string.empty': 'Firm name is required',
    'any.required': 'Firm name is required'
  }),
  abn_number: Joi.string()
    .pattern(/^\d{11}$/)
    .optional()
    .messages({
      'string.base': 'ABN number must be a string',
      'string.empty': 'ABN number is required',
      'any.required': 'ABN number is required',
      'string.pattern.base': 'ABN number must be exactly 11 digits with no spaces or symbols'
    }),
  license_number: Joi.string()
    .pattern(/^[A-Za-z0-9\-]{5,20}$/)
    .optional()
    .messages({
      'string.base': 'License number must be a string',
      'string.empty': 'License number is required',
      'any.required': 'License number is required',
      'string.pattern.base': 'License number must be alphanumeric (letters, numbers, -) and 5–20 characters long'
    }),
  image: imageRule.optional(),
}).min(1).messages({
  'object.min': 'At least one field is required to update'
});

module.exports = {
  updateBuilderSchema
};
