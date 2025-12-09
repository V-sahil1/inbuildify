const Joi = require("joi");

const createChecklistSchema = Joi.object({
  screen_id: Joi.string().uuid().required().messages({
    "string.guid": "Screen ID must be a valid UUID",
    "any.required": "Screen ID is required",
  }),
  name: Joi.string().max(150).required().messages({
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
  name: Joi.string().max(150).optional().messages({
    "any.required": " name is required.",
  }),
  functionality_id: Joi.string().uuid().optional().messages({
    "string.guid": "Functionality ID must be a valid UUID",
    "any.required": "Functionality ID is required",
  }),

  is_active: Joi.boolean().default("TRUE").optional(),
});

module.exports = {
  createChecklistSchema,
  getAllChecklistSchema,
  deleteChecklistSchema,
  updateChecklistParamsSchema,
  updateChecklistSchema,
};
