const Joi = require("joi");

const createPackageSchema = Joi.object({
  name: Joi.string().min(2).max(255).required(),
  categoryItemIds: Joi.array()
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
  amount: Joi.number().precision(2).greater(0).less(1000000).required().messages({
    "number.base": "Amount must be a valid number",
    "number.unsafe": "Amount must be a valid safe number",
    "number.min": "Amount must be greater than 0",
    "number.max": "Amount must be less than 1000000",
    "any.required": "Amount is required",
  }),
  range: Joi.string().required().messages({
    "string.base": "Range must be a string",
    "any.required": "Range is required",
  }),
  dwelling: Joi.string().required().messages({
    "string.base": "Dwelling type must be a string",
    "any.required": "Dwelling type is required",
  }),
});

const getPackageByIdSchema = Joi.object({
  package_id: Joi.string().uuid().required().messages({
    "string.guid": "Package ID must be a valid UUID",
    "any.required": "Package ID is required",
  }),
});

const getAllPackagesSchema = Joi.object({
  range: Joi.string().optional().allow(null),
  dwelling_type: Joi.string().optional().allow(null),
});

const updatePackageSchema = Joi.object({
  name: Joi.string().min(2).max(255),
  categoryItemIds: Joi.array()
    .items(Joi.string().uuid().messages({
      "string.guid": "Each Category Item ID must be a valid UUID",
    }))
    .min(1)
    .unique(),
  amount: Joi.number().precision(2).greater(0).less(1000000).required().messages({
    "number.base": "Amount must be a valid number",
    "number.unsafe": "Amount must be a valid safe number",
    "number.min": "Amount must be greater than 0",
    "number.max": "Amount must be less than 1000000",
    "any.required": "Amount is required",
  }),
  range: Joi.string().messages({
    "string.base": "Range must be a string",
  }),
  dwelling: Joi.string().messages({
    "string.base": "Dwelling type must be a string",
  }),
}).min(1).messages({
  "object.min": "At least one field (name, categoryItemIds, amount) must be provided",
});

const deletePackageSchema = Joi.object({
  package_id: Joi.string().uuid().required().messages({
    "string.guid": "Package ID must be a valid UUID",
    "any.required": "Package ID is required",
  }),
});

module.exports = {
  createPackageSchema,
  getPackageByIdSchema,
  getAllPackagesSchema,
  updatePackageSchema,
  deletePackageSchema
};
