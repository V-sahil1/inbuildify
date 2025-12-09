const Joi = require("joi");

const createPackageLabelMapSchema = Joi.object({
  package_id: Joi.string().uuid().required().messages({
    "string.guid": "Package ID must be a valid UUID",
    "any.required": "Package ID is required",
  }),

  range_id: Joi.string().uuid().required().messages({
    "string.guid": "range ID must be a valid UUID",
    "any.required": "range ID is required",
  }),
});

const getAllPackageLabelSchema = Joi.object({
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

const getPackageLabelMapByPackageIdSchema = Joi.object({
  package_id: Joi.string().uuid().required().messages({
    "string.guid": "Package ID must be a valid UUID",
    "any.required": "Package ID is required",
  }),
});

const deletePackageLabelMapSchema = Joi.object({
  id: Joi.string().uuid().required().messages({
    "string.guid": "Package label ID must be a valid UUID",
    "any.required": "Package label ID is required",
  }),
});

const udatePackageLabelMapParamsSchema = Joi.object({
  id: Joi.string().uuid().required().messages({
    "string.guid": "Package label ID must be a valid UUID",
    "any.required": "Package label ID is required",
  }),
});

const updatePackageLabelMapSchema = Joi.object({
  package_id: Joi.string().uuid().optional().messages({
    "string.guid": "Package ID must be a valid UUID",
  }),

  range_id: Joi.string().uuid().optional().messages({
    "string.guid": "range ID must be a valid UUID",
  }),
});
module.exports = {
  createPackageLabelMapSchema,
  getAllPackageLabelSchema,
  getPackageLabelMapByPackageIdSchema,
  deletePackageLabelMapSchema,
  udatePackageLabelMapParamsSchema,
  updatePackageLabelMapSchema,
};
