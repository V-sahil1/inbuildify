const Joi = require("joi");

// Reusable rules
const nameRule = Joi.string().min(2).max(100).trim().required().messages({
  "string.base": "Name must be a string",
  "string.empty": "Name is required",
  "string.min": "Name must be at least 2 characters long",
  "string.max": "Name must not exceed 100 characters",
  "any.required": "Name is required",
});

const emailRule = Joi.string().email().lowercase().trim().required().messages({
  "string.base": "Email must be a string",
  "string.empty": "Email is required",
  "string.email": "Please provide a valid email address",
  "any.required": "Email is required",
});

const passwordRule = Joi.string().min(6).max(100).required().messages({
  "string.base": "Password must be a string",
  "string.empty": "Password is required",
  "string.min": "Password must be at least 6 characters long",
  "string.max": "Password must not exceed 100 characters",
  "any.required": "Password is required",
});

const inviteUserSchema = Joi.object({
  email: emailRule,
  role: Joi.string()
    .valid(
      "super_admin",
      "admin",
      "project_owner",
      "service_provider",
      "client"
    )
    .required()
    .messages({
      "string.base": "Role must be a string",
      "any.only":
        "Role must be one of: super_admin, admin, project_owner, service_provider, client",
    }),
});

const acceptInviteSchema = Joi.object({
  name: nameRule,
  password: passwordRule,
});

const acceptInviteParamsSchema = Joi.object({
  token: Joi.string().required().messages({
    "string.base": "Invite token must be a string",
    "string.empty": "Invite token is required",
    "any.required": "Invite token is required",
  }),
});

const getInvitedUserSchema = Joi.object({
  limit: Joi.number().optional().default(25).max(50),
  offset: Joi.number().optional().default(0).max(25),
});

const getAllUserSchema = Joi.object({
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

module.exports = {
  inviteUserSchema,
  acceptInviteSchema,
  acceptInviteParamsSchema,
  getInvitedUserSchema,
  getAllUserSchema,
};
