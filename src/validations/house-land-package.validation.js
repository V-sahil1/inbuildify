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

const numericRule = Joi.number().precision(2).messages({
  "number.base": "Must be a number",
  "number.positive": "Must be a positive number",
});

const booleanRule = Joi.boolean().optional().messages({
  "boolean.base": "Must be a boolean value",
});

const createHouseLandPackageSchema = Joi.object({
  title: stringRule.max(255).required().messages({
    "any.required": "Title is required",
    "string.max": "Title must not exceed 255 characters",
  }),
  lot_id: optionalUuidRule.messages({
    "string.guid": "Lot ID must be a valid UUID",
  }),
  dwelling_type_id: optionalUuidRule.messages({
    "string.guid": "Dwelling type ID must be a valid UUID",
  }),
  package_group_id: optionalUuidRule.messages({
    "string.guid": "Package group ID must be a valid UUID",
  }),
  range_id: optionalUuidRule.messages({
    "string.guid": "Range ID must be a valid UUID",
  }),
  disclaimer_type: stringRule.max(255).optional().valid('validity', 'standard').allow(null),
  floor_plan_id: optionalUuidRule.messages({
    "string.guid": "Floor plan ID must be a valid UUID",
  }),
  facade_id: optionalUuidRule.messages({
    "string.guid": "Facade ID must be a valid UUID",
  }),
});

const updateHouseLandPackageSchema = Joi.object({
  title: stringRule.max(255).optional().messages({
    "string.max": "Title must not exceed 255 characters",
  }),
  range_id: optionalUuidRule.messages({
    "string.guid": "Range ID must be a valid UUID",
  }),
  dwelling_type_id: optionalUuidRule.messages({
    "string.guid": "Dwelling type ID must be a valid UUID",
  }),
  template_id: optionalUuidRule.messages({
    "string.guid": "Template ID must be a valid UUID",
  }),
  contact_id: optionalUuidRule.messages({
    "string.guid": "Contact ID must be a valid UUID",
  }),
  contact_show_pdf: booleanRule,
  lot_id: optionalUuidRule.messages({
    "string.guid": "Lot ID must be a valid UUID",
  }),
  price_type: stringRule.valid("estimate", "fixed").optional().messages({
    "any.only": "Price type must be either estimate or fixed",
  }),
  floor_plan_id: optionalUuidRule.messages({
    "string.guid": "Floor plan ID must be a valid UUID",
  }),
  floor_plan_description: stringRule.max(1000).optional().allow("").messages({
    "string.max": "Floor plan description must not exceed 1000 characters",
  }),
  facade_id: optionalUuidRule.messages({
    "string.guid": "Facade ID must be a valid UUID",
  }),
  package_group_id: optionalUuidRule.messages({
    "string.guid": "Package group ID must be a valid UUID",
  }),
  package_description: stringRule.max(3000).optional().allow(""),
  house_feature_id: optionalUuidRule,
  disclaimer_type: stringRule.max(255).optional().valid('validity', 'standard').allow(null),
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

const getHouseLandPackageDetailedInfoSchema = Joi.object({
  house_land_package_id: uuidRule,
});

module.exports = {
  createHouseLandPackageSchema,
  updateHouseLandPackageSchema,
  getHouseLandPackageByIdSchema,
  deleteHouseLandPackageSchema,
  getAllHouseLandPackagesSchema,
  getHouseLandPackageDetailedInfoSchema,
};