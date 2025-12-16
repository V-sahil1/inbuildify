const Joi = require("joi");

const createScreenSchema = Joi.object({
  name: Joi.string().trim().min(3).max(150).required().messages({
    "any.required": "name is required",
  }),
});

const getScreenSchema = Joi.object({
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

const deleteScreenSchema = Joi.object({
  screen_id: Joi.string().uuid().required().messages({
    "string.guid": "Surveyor ID must be a valid UUID",
    "any.required": "Surveyor ID is required",
  }),
});

const updateScreenParamsSchema = Joi.object({
  screen_id: Joi.string().uuid().required().messages({
    "string.guid": "Surveyor ID must be a valid UUID",
    "any.required": "Surveyor ID is required",
  }),
});

const updateScreenSchema = Joi.object({
  name: Joi.string().trim().min(3).max(150).required(),
});
module.exports = {
  createScreenSchema,
  getScreenSchema,
  deleteScreenSchema,
  updateScreenParamsSchema,
  updateScreenSchema,
};
