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

const rangeRule = Joi.string().valid('NONE', 'PREMIUM', 'DELUXE', 'LUXURY').messages({
  'string.base': 'Range must be a string',
  'any.only': 'Range must be one of: NONE, PREMIUM, DELUXE, LUXURY'
});

const dwellingTypeRule = Joi.string().valid('SINGLE_STOREY', 'DOUBLE_STOREY', 'RENOVATION', 'TOWN_HOUSE').messages({
  'string.base': 'Dwelling type must be a string',
  'any.only': 'Dwelling type must be one of: SINGLE_STOREY, DOUBLE_STOREY, RENOVATION, TOWN_HOUSE'
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

const booleanFilterRule = Joi.string().valid('true', 'false', 'all').messages({
  'any.only': 'Boolean filter must be one of: true, false, all'
});

// Create facade validation
const createFacadeSchema = Joi.object({
  name: nameRule.required(),
  image: imageRule.optional(),
  range: rangeRule.optional(),
  dwelling_type: dwellingTypeRule.optional(),
  standard: booleanRule('Standard').optional(),
  upgrade: booleanRule('Upgrade').optional()
});

// Get facade by ID validation (params)
const getFacadeByIdSchema = Joi.object({
  id: facadeIdRule.required()
});

// Get facades with filters validation (query)
const getFacadesSchema = Joi.object({
  range: Joi.string().valid('NONE', 'PREMIUM', 'DELUXE', 'LUXURY', 'all').optional(),
  dwelling_type: Joi.string().valid('SINGLE_STOREY', 'DOUBLE_STOREY', 'RENOVATION', 'TOWN_HOUSE', 'all').optional(),
  standard: booleanFilterRule.optional(),
  upgrade: booleanFilterRule.optional(),
  page: pageRule,
  limit: limitRule
});

// Update facade validation
const updateFacadeSchema = Joi.object({
  name: nameRule.optional(),
  image: imageRule.optional(),
  range: rangeRule.optional(),
  dwelling_type: dwellingTypeRule.optional(),
  standard: booleanRule('Standard').optional(),
  upgrade: booleanRule('Upgrade').optional()
}).min(1).messages({
  'object.min': 'At least one field is required to update'
});

// Update facade params validation
const updateFacadeParamsSchema = Joi.object({
  id: facadeIdRule.required()
});

// Delete facade validation (params)
const deleteFacadeSchema = Joi.object({
  id: facadeIdRule.required()
});

module.exports = {
  createFacadeSchema,
  getFacadeByIdSchema,
  getFacadesSchema,
  updateFacadeSchema,
  updateFacadeParamsSchema,
  deleteFacadeSchema
};