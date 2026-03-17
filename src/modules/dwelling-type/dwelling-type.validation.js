import Joi from "joi";

export const createDwellingTypeSchema = Joi.object({
  name: Joi.string()
    .trim()
    .min(2)
    .max(150)
    .pattern(/^(?=.*[a-zA-Z])[a-zA-Z0-9\s,./#-]+$/)
    .required(),
  is_active: Joi.boolean().default(true),
});

export const updateDwellingTypeSchema = {
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

export const deleteDwellingTypeSchema = {
  params: Joi.object({
    dwelling_type_id: Joi.string().uuid().required().messages({
      "string.guid": "Dwelling type ID must be a valid UUID",
      "any.required": "Dwelling type ID is required",
    }),
  }),
};

export const updateDwellingTypeParamsScehma = Joi.object({
  dwelling_type_id: Joi.string().uuid().required().messages({
    "string.guid": "Dwelling type ID must be a valid UUID",
    "any.required": "Dwelling type ID is required",
  }),
});

export const updateDwellingTypeActiveSchema = Joi.object({
  is_active: Joi.boolean().required(),
});

export default {
  createDwellingTypeSchema,
  updateDwellingTypeSchema,
  deleteDwellingTypeSchema,
  updateDwellingTypeParamsScehma,
  updateDwellingTypeActiveSchema,
};
