const Joi = require("joi");

const createUserPasswordHistorySchema = Joi.object({
  old_password: Joi.string().min(6).max(255).required().messages({
    "any.required": "Password is required",
    "string.base": "Password must be a string",
    "string.empty": "Password is required",
    "string.min": "Password must be at least 6 characters long",
    "string.max": "Password must not exceed 100 characters",
  }),
});

const getAllUserPasswordHistorySchema = Joi.object({
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

const deleteUserPasswordHistorySchema = Joi.object({
  id: Joi.string().uuid().required().messages({
    "string.guid": "Surveyor ID must be a valid UUID",
    "any.required": "Surveyor ID is required",
  }),
});

const getUserPasswordHistoryByIdSchema = Joi.object({
  id: Joi.string().uuid().required().messages({
    "string.guid": "Surveyor ID must be a valid UUID",
    "any.required": "Surveyor ID is required",
  }),
});

module.exports = {
  createUserPasswordHistorySchema,
  getAllUserPasswordHistorySchema,
  deleteUserPasswordHistorySchema,
  getUserPasswordHistoryByIdSchema,
};
