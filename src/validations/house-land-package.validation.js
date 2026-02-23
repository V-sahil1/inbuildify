const Joi = require("joi");

// Reusable rules
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

const numericRule = Joi.number().precision(2).messages({
  "number.base": "Must be a number",
  "number.positive": "Must be a positive number",
});

const booleanRule = Joi.boolean().optional().messages({
  "boolean.base": "Must be a boolean value",
});

// Schemas
const createHouseLandPackageSchema = Joi.object({
  title: stringRule.max(255).required().messages({
    "any.required": "Title is required",
    "string.max": "Title must not exceed 255 characters",
  }),
});

const updateHouseLandPackageSchema = Joi.object({
  title: stringRule.max(255).optional().messages({
    "string.max": "Title must not exceed 255 characters",
  }),
  range_id: optionalUuidRule,
  dwelling_type_id: optionalUuidRule,
  template_id: optionalUuidRule,
  contact_id: optionalUuidRule,
  contact_show_pdf: booleanRule,
  lot_id: optionalUuidRule,
  price_type: stringRule.valid("estimate", "fixed").optional().messages({
    "any.only": "Price type must be either estimate or fixed",
  }),
  commission_total: numericRule.min(0).optional().allow(null),
  house_total: numericRule.min(0).optional().allow(null),
  floor_plan_id: optionalUuidRule,
  floor_plan_description: stringRule.max(1000).optional().allow("").messages({
    "string.max": "Floor plan description must not exceed 1000 characters",
  }),
  facade_id: optionalUuidRule,
  package_group_id: Joi.array().items(optionalUuidRule).optional(),
  package_description: stringRule.max(3000).optional().allow(""),
  house_feature_id: optionalUuidRule,
  disclaimer_type: stringRule.max(255).optional().allow(""),
  disclaimer_description: stringRule.max(3000).optional().allow(""),
  attach_files: stringRule.max(500).optional().allow(""),
});

const getHouseLandPackageByIdSchema = Joi.object({
  house_land_package_id: uuidRule,
});

const deleteHouseLandPackageSchema = Joi.object({
  house_land_package_id: uuidRule,
});

const getAllHouseLandPackagesSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(25),
  lot_id: optionalUuidRule,
  range_id: optionalUuidRule,
  dwelling_type_id: optionalUuidRule,
  template_id: optionalUuidRule,
  contact_id: optionalUuidRule,
  price_type: stringRule.valid("estimate", "fixed").optional(),
  search: stringRule.max(255).optional().allow(""),
});

module.exports = {
  createHouseLandPackageSchema,
  updateHouseLandPackageSchema,
  getHouseLandPackageByIdSchema,
  deleteHouseLandPackageSchema,
  getAllHouseLandPackagesSchema,
};