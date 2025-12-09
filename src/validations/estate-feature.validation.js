const Joi = require("joi");

const createEstateFeatureSchema = Joi.object({
  estate_id: Joi.string().uuid().required().messages({
    "string.guid": "estate ID must be a valid UUID.",
  }),
  feature_name: Joi.string().trim().max(255).required(),
});

const getAllEstateFeatureSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1).messages({
    "number.base": "Page must be a number",
    "number.integer": "Page must be an integer",
    "number.min": "Page must be greater than 0",
  }),

  limit: Joi.number().integer().min(1).max(100).default(10).messages({
    "number.base": "Limit must be a number",
    "number.integer": "Limit must be an integer",
    "number.min": "Limit must be at least 1",
    "number.max": "Limit must not exceed 100",
  }),
});

const getEstateFeatureByEstateIdSchema = Joi.object({
  estate_id: Joi.string().uuid().required().messages({
    "string.guid": "estate ID must be a valid UUID.",
  }),
});

const deleteEstateFeatureSchema = Joi.object({
  estate_feature_id: Joi.string().uuid().required().messages({
    "string.guid": "estate feature ID must be a valid UUID",
    "any.required": "estate feature ID is required",
  }),
});
module.exports = {
  createEstateFeatureSchema,
  getAllEstateFeatureSchema,
  getEstateFeatureByEstateIdSchema,
  deleteEstateFeatureSchema,
};
