const Joi = require("joi");

const getAllDwellingTypesSchema = Joi.object({
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

const createDwellingTypeSchema = Joi.object({
  name: Joi.string().trim().max(150).required(),
  is_active: Joi.boolean().default(true),
});

const updateDwellingTypeSchema = {
  params: Joi.object({
    dwelling_type_id: Joi.string().uuid().required().messages({
      "string.guid": "Dwelling type ID must be a valid UUID",
      "any.required": "Dwelling type ID is required",
    }),
  }),
  body: Joi.object({
    name: Joi.string().trim().max(150).optional(),
  }),
};

const deleteDwellingTypeSchema = {
  params: Joi.object({
    dwelling_type_id: Joi.string().uuid().required().messages({
      "string.guid": "Dwelling type ID must be a valid UUID",
      "any.required": "Dwelling type ID is required",
    }),
  }),
};

const updateDwellingTypeParamsScehma = Joi.object({
  dwelling_type_id: Joi.string().uuid().required().messages({
    "string.guid": "Dwelling type ID must be a valid UUID",
    "any.required": "Dwelling type ID is required",
  }),
});

const updateDwellingTypeActiveSchema = Joi.object({
  is_active: Joi.boolean().required(),
});

module.exports = {
  getAllDwellingTypesSchema,
  createDwellingTypeSchema,
  updateDwellingTypeSchema,
  deleteDwellingTypeSchema,
  updateDwellingTypeParamsScehma,
  updateDwellingTypeActiveSchema,
};
