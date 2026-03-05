const Joi = require("joi");

const createPricelistItemMapSchema = Joi.object({
  quotation_version_id: Joi.string().uuid().required().messages({
    "string.guid": "Quotation Version ID must be a valid UUID",
    "any.required": "Quotation Version ID is required",
  }),
  price_list_item_id: Joi.string().uuid().required().messages({
    "string.guid": "Price List Item ID must be a valid UUID",
    "any.required": "Price List Item ID is required",
  }),
  quantity: Joi.number().min(0.01).required().messages({
    "number.base": "Quantity must be a number",
    "number.min": "Quantity must be greater than 0",
    "any.required": "Quantity is required",
  }),
  note: Joi.string().max(500).optional().allow(null, "").messages({
    "string.max": "Note must not exceed 500 characters",
  }),
});

const getByVersionParamsSchema = Joi.object({
  quotation_version_id: Joi.string().uuid().required().messages({
    "string.guid": "Quotation Version ID must be a valid UUID",
    "any.required": "Quotation Version ID is required",
  }),
});

const updatePricelistItemMapSchema = Joi.object({
  quantity: Joi.number().min(0.01).optional().messages({
    "number.base": "Quantity must be a number",
    "number.min": "Quantity must be greater than 0",
  }),
  note: Joi.string().max(500).optional().allow(null, "").messages({
    "string.max": "Note must not exceed 500 characters",
  }),
});

const idParamsSchema = Joi.object({
  id: Joi.string().uuid().required().messages({
    "string.guid": "ID must be a valid UUID",
    "any.required": "ID is required",
  }),
});

module.exports = {
  createPricelistItemMapSchema,
  getByVersionParamsSchema,
  updatePricelistItemMapSchema,
  idParamsSchema,
};
