const Joi = require("joi");

const uuidRule = Joi.string().uuid().required().messages({
  "string.guid": "ID must be a valid UUID",
  "any.required": "ID is required",
});

const optionalUuidRule = Joi.string().uuid().optional().allow(null).messages({
  "string.guid": "ID must be a valid UUID",
});

const stringRule = Joi.string().trim().messages({
  "string.base": "Must be a string",
  "string.empty": "Field cannot be empty",
});

const createLotPackageSchema = Joi.object({
  lot_id: uuidRule.messages({
    "any.required": "lot_id is required",
  }),
  package_name: stringRule.max(255).required().messages({
    "any.required": "Package name is required",
    "string.max": "Package name must not exceed 255 characters",
  }),
  dwelling_type_id: optionalUuidRule.required().messages({
    "any.required": "Dwelling type ID is required",
  }),
  range_id: optionalUuidRule,
  lot_package_group_id: optionalUuidRule,
  disclaimer: stringRule.max(100).optional().valid('validity', 'standard').allow("").messages({
    "string.max": "Disclaimer must not exceed 100 characters",
  }),
  floor_plan_id: optionalUuidRule,
  facade_id: optionalUuidRule,
});

const updateLotPackageSchema = Joi.object({
  package_name: stringRule.max(255).optional().messages({
    "string.max": "Package name must not exceed 255 characters",
  }),
  dwelling_type_id: optionalUuidRule,
  range_id: optionalUuidRule,
  lot_package_group_id: optionalUuidRule,
  disclaimer: stringRule.max(100).optional().valid('validity', 'standard').allow("").messages({
    "string.max": "Disclaimer must not exceed 100 characters",
  }),
  floor_plan_id: optionalUuidRule,
  facade_id: optionalUuidRule,
});

const getLotPackageByIdSchema = Joi.object({
  lot_package_id: uuidRule,
});

const deleteLotPackageSchema = Joi.object({
  lot_package_id: uuidRule,
});

const getAllLotPackagesSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(25),
  lot_id: optionalUuidRule,
  dwelling_type_id: optionalUuidRule,
  range_id: optionalUuidRule,
  lot_package_group_id: optionalUuidRule,
  search: Joi.string().trim().optional().allow(""),
});

module.exports = {
  createLotPackageSchema,
  updateLotPackageSchema,
  getLotPackageByIdSchema,
  deleteLotPackageSchema,
  getAllLotPackagesSchema,
};
