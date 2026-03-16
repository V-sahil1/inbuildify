import Joi from "joi";

const createChecklistSchema = Joi.object({
  screen_id: Joi.string().uuid().required().messages({
    "string.guid": "Screen ID must be a valid UUID",
    "any.required": "Screen ID is required",
  }),
  name: Joi.string()
    .min(2)
    .max(150)
    .pattern(/^(?=.*[a-zA-Z])[a-zA-Z0-9\s,./#-]+$/)
    .required()
    .messages({
      "string.pattern.base": "Name must contain at least one letter",
      "any.required": " name is required.",
    }),
  functionality_id: Joi.string().uuid().required().messages({
    "string.guid": "Functionality ID must be a valid UUID",
    "any.required": "Functionality ID is required",
  }),

  is_active: Joi.boolean().default(true),
});

const getAllChecklistSchema = Joi.object({
  checklist_id: Joi.string().uuid().required().messages({
    "string.guid": "Checklist ID must be a valid UUID",
    "any.required": "Checklist ID is required",
  }),
});

const deleteChecklistSchema = Joi.object({
  checklist_id: Joi.string().uuid().required().messages({
    "string.guid": "Checklist ID must be a valid UUID",
    "any.required": "Checklist ID is required",
  }),
});

const updateChecklistParamsSchema = Joi.object({
  checklist_id: Joi.string().uuid().required().messages({
    "string.guid": "Checklist ID must be a valid UUID",
    "any.required": "Checklit ID is required",
  }),
});

const updateChecklistSchema = Joi.object({
  screen_id: Joi.string().uuid().optional().messages({
    "string.guid": "Screen ID must be a valid UUID",
    "any.required": "Screen ID is required",
  }),
  name: Joi.string()
    .min(2)
    .max(150)
    .pattern(/^(?=.*[a-zA-Z])[a-zA-Z0-9\s,./#-]+$/)
    .optional()
    .messages({
      "string.pattern.base": "Name must contain at least one letter",
      "any.required": " name is required.",
    }),
  functionality_id: Joi.string().uuid().optional().messages({
    "string.guid": "Functionality ID must be a valid UUID",
    "any.required": "Functionality ID is required",
  }),
});

const updateChecklistIsActiveSchema = Joi.object({
  is_active: Joi.boolean().required(),
});

export default {
  createChecklistSchema,
  getAllChecklistSchema,
  deleteChecklistSchema,
  updateChecklistParamsSchema,
  updateChecklistSchema,
  updateChecklistIsActiveSchema,
};
