import Joi from "joi";

export const createRoleSchema = Joi.object({
  name: Joi.string().trim().min(3).max(150).required().messages({
    "string.empty": "Role name is required.",
    "any.required": "Role name is required.",
  }),

  description: Joi.string().optional(),
});

export const getAllRoleSchema = Joi.object({
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

export const deleteRoleSchema = Joi.object({
  id: Joi.string().uuid().required().messages({
    "string.guid": "Role ID must be a valid UUID",
    "any.required": "Role ID is required",
  }),
});

export const updateRoleIdParamsSchema = Joi.object({
  role_id: Joi.string().uuid().required().messages({
    "string.guid": "Role ID must be a valid UUID",
    "any.required": "Role ID is required",
  }),
});

export const updateRoleSchema = Joi.object({
  name: Joi.string().trim().min(3).max(150).optional().messages({
    "string.empty": "Role name is can not be empty.",
  }),

  type: Joi.string().trim().min(2).max(100).optional(),

  description: Joi.string().optional(),
})
  .min(1)
  .messages({
    "object.min": "At least one field is required to update.",
  });

export default {
  createRoleSchema,
  getAllRoleSchema,
  deleteRoleSchema,
  updateRoleIdParamsSchema,
  updateRoleSchema,
};
