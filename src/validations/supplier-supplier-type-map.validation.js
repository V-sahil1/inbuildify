const Joi = require("joi");

const createSupplierTypeMapSchema = Joi.object({
  supplier_id: Joi.string().uuid().required().messages({
    "string.guid": "Supplier ID must be a valid UUID",
    "any.required": "Supplier ID is required",
  }),

  supplier_type_id: Joi.string().uuid().required().messages({
    "string.guid": "Supplier type ID must be a valid UUID",
    "any.required": "Supplier type ID is required",
  }),
});

const getAllSupplierTypeMapsSchema = Joi.object({
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

const deleteSupplierSupplierTypeMapSchema = Joi.object({
  id: Joi.string().uuid().required().messages({
    "string.guid": "Supplier type map ID must be a valid UUID",
    "any.required": "Supplier type map ID is required",
  }),
});

const updateSupplierTypeParamsSchema = Joi.object({
  id: Joi.string().uuid().required().messages({
    "string.guid": "Supplier type map ID must be a valid UUID",
    "any.required": "Supplier type map ID is required",
  }),
});

const updateSupplierTypeMapSchema = Joi.object({
  assign_to_new_and_existing_checklist: Joi.boolean().optional(),
});

const createSupplierTpeChecklistSchema = Joi.object({
  supplier_type_id: Joi.string().uuid().required().messages({
    "string.guid": "Supplier type ID must be a valid UUID",
    "any.required": "Supplier type ID is required",
  }),

  construction_checklist_id: Joi.string().uuid().required().messages({
    "string.guid": "Construction checklist id must be a valid UUID",
    "any.required": "construction checklist id is required",
  }),
});
module.exports = {
  createSupplierTypeMapSchema,
  getAllSupplierTypeMapsSchema,
  deleteSupplierSupplierTypeMapSchema,
  updateSupplierTypeParamsSchema,
  updateSupplierTypeMapSchema,
  createSupplierTpeChecklistSchema,
};
