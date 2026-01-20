const Joi = require("joi");

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
  createDwellingTypeSchema,
  updateDwellingTypeSchema,
  deleteDwellingTypeSchema,
  updateDwellingTypeParamsScehma,
  updateDwellingTypeActiveSchema,
};
