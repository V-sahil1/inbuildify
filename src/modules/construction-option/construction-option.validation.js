import Joi from "joi";

const createConstructionOptionSchema = Joi.object({
  option_name: Joi.string()
    .trim()
    .min(2)
    .max(255)
    .pattern(/^(?=.*[a-zA-Z])[a-zA-Z0-9\s,./#-]+$/)
    .required(),
});

const deleteConstructionOptionSchema = Joi.object({
  id: Joi.string().uuid().required().messages({
    "string.guid": "construction option ID must be a valid UUID",
    "any.required": "construction option ID is required",
  }),
});

const updateConstructionOptionParamsSchema = Joi.object({
  id: Joi.string().uuid().required().messages({
    "string.guid": "construction option ID must be a valid UUID",
    "any.required": "construction option ID is required",
  }),
});

const updateConstructionOptionSchema = Joi.object({
  option_name: Joi.string()
    .min(2)
    .trim()
    .max(255)
    .pattern(/^(?=.*[a-zA-Z])[a-zA-Z0-9\s,./#-]+$/)
    .optional(),
});

export default {
  createConstructionOptionSchema,
  deleteConstructionOptionSchema,
  updateConstructionOptionParamsSchema,
  updateConstructionOptionSchema,
};
