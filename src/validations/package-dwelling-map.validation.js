const Joi = require("joi");

const createPackageDwellingMaoSchema = Joi.object({
  package_id: Joi.string().uuid().required().messages({
    "string.guid": "Package ID must be a valid UUID",
    "any.required": "Package ID is required",
  }),
  dwelling_type_id: Joi.string().uuid().required().messages({
    "string.guid": "dwelling type ID must be a valid UUID",
    "any.required": "dwelling type  ID is required",
  }),
});

const getAllPackageDwellingMapSchema = Joi.object({
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

const deletePackageDwellingMapSchema = Joi.object({
  id: Joi.string().uuid().required().messages({
    "string.guid": "Package dwelling map ID must be a valid UUID",
    "any.required": "Package dwelling map ID is required",
  }),
});

const getPackageDwellingMapByPackageIdSchema = Joi.object({
  package_id: Joi.string().uuid().required().messages({
    "string.guid": "Package ID must be a valid UUID",
    "any.required": "Package ID is required",
  }),
});

const updatePackageDwellingMapByPackageParamsSchema = Joi.object({
  id: Joi.string().uuid().required().messages({
    "string.guid": "Package ID must be a valid UUID",
    "any.required": "Package ID is required",
  }),
});

const updatePackageDwellingMapSchema = Joi.object({
  package_id: Joi.string().uuid().optional().messages({
    "string.guid": "Package ID must be a valid UUID",
  }),
  dwelling_type_id: Joi.string().uuid().optional().messages({
    "string.guid": "dwelling type ID must be a valid UUID",
  }),
});
module.exports = {
  createPackageDwellingMaoSchema,
  getAllPackageDwellingMapSchema,
  getPackageDwellingMapByPackageIdSchema,
  deletePackageDwellingMapSchema,
  updatePackageDwellingMapByPackageParamsSchema,
  updatePackageDwellingMapSchema,
};
