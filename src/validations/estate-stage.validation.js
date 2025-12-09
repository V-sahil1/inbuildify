const Joi = require("joi");

const createEstateStageSchema = Joi.object({
  estate_id: Joi.string().uuid().required().messages({
    "string.guid": "estate ID must be a valid UUID.",
  }),
  name: Joi.string().trim().max(150).required(),
  release_date: Joi.date().optional().allow(null),
});

const getALLEstateStageSchema = Joi.object({
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
  name: Joi.string().trim().max(150).optional(),
  release_date: Joi.date().optional().allow(null),
});
module.exports = {
  createEstateStageSchema,
  getALLEstateStageSchema,
  deleteEstateStageSchema,
  updateEstateStageParamsSchema,
  updsteEstateStageSchema,
};
