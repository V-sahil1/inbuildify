const Joi = require("joi");

const createPackageGroupMapSchema = Joi.object({
  package_id: Joi.string().uuid().required().messages({
    "string.guid": "Package ID must be a valid UUID",
    "any.required": "Package ID is required",
  }),
  package_group_id: Joi.string().uuid().required().messages({
    "string.guid": "Package group ID must be a valid UUID",
    "any.required": "Package group ID is required",
  }),
});

const getAllPackageGroupmaoSchema = Joi.object({
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

const getPackageGroupMapByPackageIdSchema = Joi.object({
  package_id: Joi.string().uuid().required().messages({
    "string.guid": "Package ID must be a valid UUID",
    "any.required": "Package ID is required",
  }),
});

const deletePackageGroupMapSchema = Joi.object({
  id: Joi.string().uuid().required().messages({
    "string.guid": "Package group ID must be a valid UUID",
    "any.required": "Package group ID is required",
  }),
});

const updatePackageGroupMapParamsSchema = Joi.object({
  id: Joi.string().uuid().required().messages({
    "string.guid": "Package group map ID must be a valid UUID",
    "any.required": "Package group map ID is required",
  }),
});

const updatePackageGroupMapSchema = Joi.object({
  package_id: Joi.string().uuid().optional().messages({
    "string.guid": "Package ID must be a valid UUID",
  }),
  package_group_id: Joi.string().uuid().optional().messages({
    "string.guid": "Package group ID must be a valid UUID",
  }),
});

module.exports = {
  createPackageGroupMapSchema,
  getAllPackageGroupmaoSchema,
  getPackageGroupMapByPackageIdSchema,
  deletePackageGroupMapSchema,
  updatePackageGroupMapParamsSchema,
  updatePackageGroupMapSchema,
};
