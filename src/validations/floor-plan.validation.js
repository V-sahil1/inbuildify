const Joi = require('joi');

// Reusable rules
const nameRule = Joi.string().min(2).max(100).trim().messages({
  'string.base': 'Name must be a string',
  'string.empty': 'Name is required',
  'string.min': 'Name must be at least 2 characters long',
  'string.max': 'Name must not exceed 100 characters',
  'any.required': 'Name is required'
});

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
    size: Joi.number().max(10 * 1024 * 1024).required(), // enforce max 10MB
    location: Joi.string().uri().required() // s3 URL added by multer-s3
  }).unknown(true) // allow extra multer fields
).optional();

const rangeRule = Joi.string().valid('NONE', 'PREMIUM', 'DELUXE', 'LUXURY').messages({
  'string.base': 'Range must be a string',
  'any.only': 'Range must be one of: NONE, PREMIUM, DELUXE, LUXURY'
});

const dwellingTypeRule = Joi.string().valid('SINGLE_STOREY', 'DOUBLE_STOREY', 'RENOVATION', 'TOWN_HOUSE').messages({
  'string.base': 'Dwelling type must be a string',
  'any.only': 'Dwelling type must be one of: SINGLE_STOREY, DOUBLE_STOREY, RENOVATION, TOWN_HOUSE'
});

const integerRule = (fieldName) => Joi.number().integer().min(0).messages({
  'number.base': `${fieldName} must be a number`,
  'number.integer': `${fieldName} must be an integer`,
  'number.min': `${fieldName} must be greater than or equal to 0`
});

const decimalRule = (fieldName) => Joi.number().precision(2).min(0).messages({
  'number.base': `${fieldName} must be a number`,
  'number.precision': `${fieldName} must have at most 2 decimal places`,
  'number.min': `${fieldName} must be greater than or equal to 0`
});

const floorPlanIdRule = Joi.string().uuid().messages({
  'string.base': 'Floor plan ID must be a string',
  'string.empty': 'Floor plan ID is required',
  'string.guid': 'Floor plan ID must be a valid UUID',
  'any.required': 'Floor plan ID is required'
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

// Create floor plan validation
const createFloorPlanSchema = Joi.object({
  name: nameRule.required(),
  image: imageRule.optional(),
  range: rangeRule.optional(),
  dwelling_type: dwellingTypeRule.optional(),
  beds: integerRule('Beds').optional(),
  bath: integerRule('Bath').optional(),
  car_park: integerRule('Car park').optional(),
  width_meter: decimalRule('Width').optional(),
  depth_meter: decimalRule('Depth').optional(),
  dwelling: integerRule('Dwelling').optional(),
  garage: integerRule('Garage').optional(),
  porch: integerRule('Porch').optional(),
  alfresco: integerRule('Alfresco').optional(),
  total_sqft: decimalRule('Total square feet').optional()
});

// Get floor plan by ID validation (params)
const getFloorPlanByIdSchema = Joi.object({
  id: floorPlanIdRule.required()
});

// Get floor plans with filters validation (query)
const getFloorPlansSchema = Joi.object({
  range: Joi.string().valid('NONE', 'PREMIUM', 'DELUXE', 'LUXURY', 'all').optional(),
  dwelling_type: Joi.string().valid('SINGLE_STOREY', 'DOUBLE_STOREY', 'RENOVATION', 'TOWN_HOUSE', 'all').optional(),
  page: pageRule,
  limit: limitRule
});

// Update floor plan validation
const updateFloorPlanSchema = Joi.object({
  name: nameRule.optional(),
  image: imageRule.optional(),
  range: rangeRule.optional(),
  dwelling_type: dwellingTypeRule.optional(),
  beds: integerRule('Beds').optional(),
  bath: integerRule('Bath').optional(),
  car_park: integerRule('Car park').optional(),
  width_meter: decimalRule('Width').optional(),
  depth_meter: decimalRule('Depth').optional(),
  dwelling: integerRule('Dwelling').optional(),
  garage: integerRule('Garage').optional(),
  porch: integerRule('Porch').optional(),
  alfresco: integerRule('Alfresco').optional(),
  total_sqft: decimalRule('Total square feet').optional()
}).min(1).messages({
  'object.min': 'At least one field is required to update'
});

// Update floor plan params validation
const updateFloorPlanParamsSchema = Joi.object({
  id: floorPlanIdRule.required()
});

// Delete floor plan validation (params)
const deleteFloorPlanSchema = Joi.object({
  id: floorPlanIdRule.required()
});

module.exports = {
  createFloorPlanSchema,
  getFloorPlanByIdSchema,
  getFloorPlansSchema,
  updateFloorPlanSchema,
  updateFloorPlanParamsSchema,
  deleteFloorPlanSchema
};