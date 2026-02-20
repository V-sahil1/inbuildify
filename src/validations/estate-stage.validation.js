const Joi = require("joi");

const createEstateStageSchema = Joi.object({
  estate_id: Joi.string().uuid().required().messages({
    "string.guid": "estate ID must be a valid UUID.",
  }),
  name: Joi.string()
    .trim()
    .min(2)
    .max(150)
    .pattern(/^(?=.*[a-zA-Z])[a-zA-Z0-9\s,./#-]+$/)
    .required(),
  release_date: Joi.date().optional().allow(null),
  attach_file: Joi.string().uri().optional().allow(null, "").messages({
    "string.uri": "attach_file must be a valid URL",
  }),
});

const getALLEstateStageSchema = Joi.object({
  estate_id: Joi.string().uuid().optional().messages({
    "string.guid": "estate ID must be a valid UUID",
  }),
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

const deleteEstateStageSchema = Joi.object({
  estate_stage_id: Joi.string().uuid().required().messages({
    "string.guid": "estate stage ID must be a valid UUID",
    "any.required": "estate stage ID is required",
  }),
});

const updateEstateStageParamsSchema = Joi.object({
  estate_stage_id: Joi.string().uuid().required().messages({
    "string.guid": "estate stage ID must be a valid UUID",
    "any.required": "estate stage ID is required",
  }),
});

const updsteEstateStageSchema = Joi.object({
  name: Joi.string()
    .trim()
    .min(2)
    .max(150)
    .pattern(/^(?=.*[a-zA-Z])[a-zA-Z0-9\s,./#-]+$/)
    .optional(),
  release_date: Joi.date().optional().allow(null),
  attach_file: Joi.string().uri().optional().allow(null, "").messages({
    "string.uri": "attach_file must be a valid URL",
  }),
});
module.exports = {
  createEstateStageSchema,
  getALLEstateStageSchema,
  deleteEstateStageSchema,
  updateEstateStageParamsSchema,
  updsteEstateStageSchema,
};
