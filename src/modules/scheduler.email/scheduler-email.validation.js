const Joi = require("joi");

const createSchedulerEmailSchema = Joi.object({
  name: Joi.string()
    .min(2)
    .max(200)
    .pattern(/^(?=.*[a-zA-Z])[a-zA-Z0-9\s,./#-]+$/)
    .required(),
  frequency: Joi.string()
    .max(100)
    .valid("daily", "weekly", "monthly")
    .required(),
  send_to_all_active_users: Joi.boolean().default(false),
  notification_recipient_users: Joi.array()
    .items(Joi.string().uuid())
    .default([]),
  reply_to_users: Joi.array().items(Joi.string().uuid()).default([]).optional(),
  subject: Joi.string()
    .min(2)
    .max(255)
    .pattern(/^(?=.*[a-zA-Z])[a-zA-Z0-9\s,./#-]+$/)
    .required(),
  message_body: Joi.string().required(),
  no_of_action_days: Joi.number().integer().min(0).optional(),
  no_record_message: Joi.boolean().default(false),
  no_record_message_body: Joi.when("no_record_message", {
    is: true,
    then: Joi.string().required(),
    otherwise: Joi.forbidden().messages({
      "any.unknown":
        "You cannot provide no_record_message_body when no_record_message is false.",
    }),
  }),
  attach_files: Joi.string().allow(null, "").optional(),
  attachFiles: Joi.string().allow(null, "").optional(),
  is_active: Joi.boolean().default(true),
});

const getAllSchedulerEmailSchema = Joi.object({
  is_active: Joi.boolean().optional(),
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

const deleteSchedulerEmailSchema = Joi.object({
  scheduler_email_id: Joi.string().uuid().required().messages({
    "string.guid": "ID must be a valid UUID",
    "any.required": "ID is required",
  }),
});

const getSchedulerEmailSchema = Joi.object({
  is_active: Joi.boolean().optional(),
});

const updateSchedulerEmailParamsSchema = Joi.object({
  scheduler_email_id: Joi.string().uuid().required().messages({
    "string.guid": "scheduler email ID must be a valid UUID",
    "any.required": "scheduler email ID is required",
  }),
});

const updateSchedulerEmailSchema = Joi.object({
  name: Joi.string()
    .min(2)
    .max(200)
    .pattern(/^(?=.*[a-zA-Z])[a-zA-Z0-9\s,./#-]+$/)
    .optional(),
  frequency: Joi.string().valid("daily", "weekly", "monthly").optional(),
  send_to_all_active_users: Joi.boolean(),
  notification_recipient_users: Joi.array()
    .items(Joi.string().uuid())
    .default([])
    .messages({
      "string.guid": "User ID must be a valid UUID",
    }),
  reply_to_users: Joi.array().items(Joi.string().uuid()).default([]).messages({
    "string.guid": "User ID must be a valid UUID",
  }),
  subject: Joi.string()
    .min(2)
    .max(255)
    .pattern(/^(?=.*[a-zA-Z])[a-zA-Z0-9\s,./#-]+$/)
    .optional(),
  message_body: Joi.string().optional(),
  no_of_action_days: Joi.number().integer().min(0).optional(),
  no_record_message: Joi.boolean(),
  exclude_recipients: Joi.array()
    .items(Joi.string().uuid())
    .default([])
    .messages({
      "string.guid": "User ID must be a valid UUID",
    }),
  no_record_message_body: Joi.when("no_record_message", {
    is: true,
    then: Joi.string().optional(),
    otherwise: Joi.forbidden().messages({
      "any.unknown":
        "You cannot provide no_record_message_body when no_record_message is false.",
    }),
  }),
  attach_files: Joi.string().allow(null, "").optional(),
  attachFiles: Joi.string().allow(null, "").optional(),
  is_active: Joi.boolean(),
});

module.exports = {
  createSchedulerEmailSchema,
  getAllSchedulerEmailSchema,
  deleteSchedulerEmailSchema,
  updateSchedulerEmailParamsSchema,
  updateSchedulerEmailSchema,
  getSchedulerEmailSchema,
};
