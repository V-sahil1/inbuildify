const Joi = require("joi");

const createPackageGroupSchema = Joi.object({
  name: Joi.string().trim().max(150).required(),
  no_of_packages: Joi.number().integer().min(0).default(0),
  is_active: Joi.boolean().default(true),
});

const getAllPackageGroupSchema = Joi.object({
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

const deletePackageGroupSchema = Joi.object({
  package_group_id: Joi.string().uuid().required().messages({
    "string.guid": "Package ID must be a valid UUID",
    "any.required": "Package ID is required",
  }),
});

const updatePackageGroupParamsSchema = Joi.object({
  package_group_id: Joi.string().uuid().required().messages({
    "string.guid": "Package ID must be a valid UUID",
    "any.required": "Package ID is required",
  }),
});

const updatePackageGroupSchema = Joi.object({
  name: Joi.string().trim().max(150).optional(),
  no_of_packages: Joi.number().integer().min(0).optional(),
  is_active: Joi.boolean().optional(),
});

module.exports = {
  createPackageGroupSchema,
  getAllPackageGroupSchema,
  deletePackageGroupSchema,
  updatePackageGroupParamsSchema,
  updatePackageGroupSchema,
};
