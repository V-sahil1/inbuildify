const Joi = require("joi");

const createPriceListItemMapSchema = Joi.object({
  house_land_package_id: Joi.string().uuid().required().messages({
    "string.uuid": "house_land_package_id must be a valid UUID",
    "any.required": "house_land_package_id is required",
  }),
  price_list_item_id: Joi.string().uuid().required().messages({
    "string.uuid": "price_list_item_id must be a valid UUID",
    "any.required": "price_list_item_id is required",
  }),
  quantity: Joi.number().integer().min(1).optional().messages({
    "number.base": "quantity must be a number",
    "number.integer": "quantity must be an integer",
    "number.min": "quantity must be at least 1",
  }),
  note: Joi.string().max(500).optional().allow(null, "").messages({
    "string.max": "Note must not exceed 500 characters",
  }),
});

const updatePriceListItemMapSchema = Joi.object({
  quantity: Joi.number().integer().min(1).optional().messages({
    "number.base": "quantity must be a number",
    "number.integer": "quantity must be an integer",
    "number.min": "quantity must be at least 1",
  }),
  note: Joi.string().max(500).optional().allow(null, "").messages({
    "string.max": "Note must not exceed 500 characters",
  }),
});

const getPriceListItemMapsSchema = Joi.object({
  house_land_package_id: Joi.string().uuid().required().messages({
    "string.uuid": "house_land_package_id must be a valid UUID",
    "any.required": "house_land_package_id is required",
  }),
});

const deletePriceListItemMapSchema = Joi.object({
  id: Joi.string().uuid().required().messages({
    "string.uuid": "id must be a valid UUID",
    "any.required": "id is required",
  }),
});

const createPackageCommissionMapSchema = Joi.object({
  house_land_package_id: Joi.string().uuid().required().messages({
    "string.uuid": "house_land_package_id must be a valid UUID",
    "any.required": "house_land_package_id is required",
  }),
  job_commission_id: Joi.alternatives().try(
    Joi.string().uuid(),
    Joi.array().items(Joi.string().uuid())
  ).required().messages({
    "alternatives.match": "job_commission_id must be a valid UUID or an array of UUIDs",
    "any.required": "job_commission_id is required",
  }),
});

const updatePackageCommissionMapSchema = Joi.object({
  job_commission_id: Joi.string().uuid().optional().messages({
    "string.uuid": "job_commission_id must be a valid UUID",
  }),
});

module.exports = {
  createPriceListItemMapSchema,
  updatePriceListItemMapSchema,
  getPriceListItemMapsSchema,
  deletePriceListItemMapSchema,
  createPackageCommissionMapSchema,
  updatePackageCommissionMapSchema,
};