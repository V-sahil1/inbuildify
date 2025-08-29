const Joi = require("joi");

const createPackageSchema = Joi.object({
  name: Joi.string().min(2).max(255).required(),
  category_item_ids: Joi.array()
    .items(
      Joi.string().uuid().messages({
        "string.guid": "Each Category Item ID must be a valid UUID",
      })
    )
    .min(1)
    .unique()
    .required()
    .messages({
      "array.base": "Category Item IDs must be an array of UUIDs",
      "array.min": "At least one Category Item ID is required",
      "array.unique": "Category Item IDs must be unique",
      "any.required": "Category Item IDs are required",
    }),
  amount: Joi.number().precision(2).min(0).required().messages({
    "number.base": "Amount must be a number",
    "number.min": "Amount must be greater than or equal to 0",
  }),
});

const getPackageByIdSchema = Joi.object({
  package_id: Joi.string().uuid().required().messages({
    "string.guid": "Package ID must be a valid UUID",
    "any.required": "Package ID is required",
  }),
});

const getPackageItemsSchema = Joi.object({
  range: Joi.string().required().messages({
    "string.base": "Range must be a string",
    "any.required": "Range is required",
  }),
  dwelling_type: Joi.string().required().messages({
    "string.base": "Dwelling type must be a string",
    "any.required": "Dwelling type is required",
  }),
});

module.exports = {
  createPackageSchema,
  getPackageByIdSchema,
  getPackageItemsSchema,
};
