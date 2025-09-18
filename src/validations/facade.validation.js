const Joi = require('joi');

// Reusable rules
const nameRule = Joi.string().min(2).max(100).trim().messages({
  'string.base': 'Name must be a string',
  'string.empty': 'Name is required',
  'string.min': 'Name must be at least 2 characters long',
  'string.max': 'Name must not exceed 100 characters',
  'any.required': 'Name is required'
});

const imageRule = Joi.string().uri().max(500).trim().messages({
  'string.base': 'Image must be a string',
  'string.uri': 'Image must be a valid URL',
  'string.max': 'Image URL must not exceed 500 characters'
});

const dwellingTypeRule = Joi.string().messages({
  'string.base': 'Dwelling type must be a string'
});

const booleanRule = (fieldName) => Joi.boolean().messages({
  'boolean.base': `${fieldName} must be a boolean value`
});

const facadeIdRule = Joi.string().uuid().messages({
  'string.base': 'Facade ID must be a string',
  'string.empty': 'Facade ID is required',
  'string.guid': 'Facade ID must be a valid UUID',
  'any.required': 'Facade ID is required'
});

const pageRule = Joi.number().integer().min(1).default(1).messages({
  'number.base': 'Page must be a number',
  'number.integer': 'Page must be an integer',
  'number.min': 'Page must be greater than 0'
});

const limitRule = Joi.number().integer().min(1).max(100).default(10).messages({
  'number.base': 'Limit must be a number',
  'number.integer': 'Limit must be an integer',
  'number.min': 'Limit must be at least 1',
  'number.max': 'Limit must not exceed 100'
});

const booleanFilterRule = Joi.string().valid('true', 'false').messages({
  'any.only': 'Boolean filter must be one of: true, false'
});

// Create facade validation
const createFacadeSchema = Joi.object({
  name: nameRule.required(),
  image: imageRule.optional(),
  dwelling_type: dwellingTypeRule.optional(),
  standard: booleanRule('Standard').optional(),
  upgrade: booleanRule('Upgrade').optional(),
  cost: Joi.string().required().pattern(/^\d+$/).custom((value, helpers) => {
    try {
      const num = BigInt(value);
      if (num <= 0n) return helpers.error("number.min");
      if (num > 1000000n) return helpers.error("number.max");
      return Number(num); // or keep as string if safer
    } catch {
      return helpers.error("number.base");
    }
  }).messages({
    "string.pattern.base": "Cost must be a valid number",
    "number.min": "Cost must not be less than 0",
    "number.max": "Cost must not exceed 1000000"
  }),
});

// Get facade by ID validation (params)
const getFacadeByIdSchema = Joi.object({
  facade_id: facadeIdRule.required()
});

// Get facades with filters validation (query)
const getFacadesSchema = Joi.object({
  dwelling_type: Joi.string().optional(),
  standard: booleanFilterRule.optional(),
  upgrade: booleanFilterRule.optional(),
  cost: Joi.string().optional().pattern(/^\d+$/).custom((value, helpers) => {
    try {
      const num = BigInt(value);
      if (num <= 0n) return helpers.error("number.min");
      if (num > 1000000n) return helpers.error("number.max");
      return Number(num); // or keep as string if safer
    } catch {
      return helpers.error("number.base");
    }
  }).messages({
    "string.pattern.base": "Cost must be a valid number",
    "number.min": "Cost must not be less than 0",
    "number.max": "Cost must not exceed 1000000"
  }),
  page: pageRule,
  limit: limitRule
});

// Update facade validation
const updateFacadeSchema = Joi.object({
  name: nameRule.optional(),
  image: imageRule.optional(),
  dwelling_type: dwellingTypeRule.optional(),
  standard: booleanRule('Standard').optional(),
  cost: Joi.string().optional().pattern(/^\d+$/).custom((value, helpers) => {
    try {
      const num = BigInt(value);
      if (num <= 0n) return helpers.error("number.min");
      if (num > 1000000n) return helpers.error("number.max");
      return Number(num); // or keep as string if safer
    } catch {
      return helpers.error("number.base");
    }
  }).messages({
    "string.pattern.base": "Cost must be a valid number",
    "number.min": "Cost must not be less than 0",
    "number.max": "Cost must not exceed 1000000"
  }),
  upgrade: booleanRule('Upgrade').optional()
}).min(1).messages({
  'object.min': 'At least one field is required to update'
});

// Update facade params validation
const updateFacadeParamsSchema = Joi.object({
  facade_id: facadeIdRule.required()
});

// Delete facade validation (params)
const deleteFacadeSchema = Joi.object({
  facade_id: facadeIdRule.required()
});

module.exports = {
  createFacadeSchema,
  getFacadeByIdSchema,
  getFacadesSchema,
  updateFacadeSchema,
  updateFacadeParamsSchema,
  deleteFacadeSchema
};