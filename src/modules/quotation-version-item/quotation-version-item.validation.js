import Joi from "joi";

export const addQuotationItemSchema = Joi.object({
  quotation_version_id: Joi.string().uuid().required().messages({
    "string.guid": "Quotation Version ID must be a valid UUID",
    "any.required": "Quotation Version ID is required",
  }),
  price_list_item_id: Joi.string().uuid().required().messages({
    "string.guid": "Price List Item ID must be a valid UUID",
    "any.required": "Price List Item ID is required",
  }),
  quantity: Joi.number().min(0.01).optional().messages({
    "number.base": "Quantity must be a number",
    "number.min": "Quantity must be greater than 0",
  }),
  note: Joi.string().max(500).optional().allow(null, "").messages({
    "string.max": "Note must not exceed 500 characters",
  }),
});

export const addQuotationPackageSchema = Joi.object({
  quotation_version_id: Joi.string().uuid().required().messages({
    "string.guid": "Quotation Version ID must be a valid UUID",
    "any.required": "Quotation Version ID is required",
  }),
  package_id: Joi.string().uuid().required().messages({
    "string.guid": "Package ID must be a valid UUID",
    "any.required": "Package ID is required",
  }),
});

export const updateQuotationItemSchema = Joi.object({
  quantity: Joi.number().min(0.01).optional().messages({
    "number.base": "Quantity must be a number",
    "number.min": "Quantity must be greater than 0",
  }),
  price_list_item_description: Joi.string().optional().allow(null, "").messages({
    "string.base": "Price List Item Description must be a string",
  }),
  note: Joi.string().max(500).optional().allow(null, "").messages({
    "string.max": "Note must not exceed 500 characters",
  }),
});

export const getItemsByVersionParamsSchema = Joi.object({
  quotation_version_id: Joi.string().uuid().required().messages({
    "string.guid": "Quotation Version ID must be a valid UUID",
    "any.required": "Quotation Version ID is required",
  }),
});

export const getItemsByVersionQuerySchema = Joi.object({
  package_id: Joi.string().uuid().optional().messages({
    "string.guid": "Package ID must be a valid UUID",
  }),
});

export const idParamsSchema = Joi.object({
  id: Joi.string().uuid().required().messages({
    "string.guid": "ID must be a valid UUID",
    "any.required": "ID is required",
  }),
});

export const deletePackageParamsSchema = Joi.object({
  quotation_version_id: Joi.string().uuid().required(),
  package_id: Joi.string().uuid().required(),
});

export default {
  addQuotationItemSchema,
  addQuotationPackageSchema,
  updateQuotationItemSchema,
  getItemsByVersionParamsSchema,
  idParamsSchema,
  deletePackageParamsSchema,
};
