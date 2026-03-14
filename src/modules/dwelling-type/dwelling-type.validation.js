const Joi = require("joi");

const createDwellingTypeSchema = Joi.object({
  name: Joi.string()
    .trim()
    .min(2)
    .max(150)
    .pattern(/^(?=.*[a-zA-Z])[a-zA-Z0-9\s,./#-]+$/)
    .required(),
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
    name: Joi.string()
      .trim()
      .min(2)
      .max(150)
      .pattern(/^(?=.*[a-zA-Z])[a-zA-Z0-9\s,./#-]+$/)
      .optional(),
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
