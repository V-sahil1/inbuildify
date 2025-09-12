const Joi = require("joi");

const createActionSchema = {
  params: Joi.object({
    lead_id: Joi.string().uuid().required().messages({
      "string.guid": "Lead ID must be a valid UUID",
      "any.required": "Lead ID is required",
    }),
  }),
  body: Joi.object({
    type: Joi.string().valid("NOTES", "SMS", "APPOINTMENT", "TASK").required(),

    message: Joi.string().max(500),
    tags: Joi.array().items(Joi.string()),
    attachment: Joi.string().uri().max(500).trim().messages({
      'string.base': 'Image must be a string',
      'string.uri': 'Image must be a valid URL',
      'string.max': 'Image URL must not exceed 500 characters'
    }).optional(),

    sendToCustomer: Joi.boolean().default(false),
    createFollowUpTask: Joi.boolean().default(false),

    task: Joi.object({
      name: Joi.string().max(200).required(),
      due_date: Joi.date().required(),
      priority: Joi.string().valid("HIGH", "LOW", "MEDIUM").required(),
      time: Joi.string().optional(),
      assignee: Joi.string().uuid().optional(),
      description: Joi.string().optional(),
    }).when("createFollowUpTask", {
      is: true,
      then: Joi.required(),
      otherwise: Joi.optional(),
    }),

    recipient: Joi.array().items(Joi.string().uuid()).messages({
      "array.base": "Recipient must be an array of UUIDs",
      "array.min": "At least one recipient is required",
      "array.unique": "Recipient must be unique",
      "any.required": "Recipient is required",
    }).optional().allow(null),

    title: Joi.string().max(200),
    date: Joi.date(),
    start_time: Joi.string(),
    end_time: Joi.string(),
    location: Joi.string().max(200),
    select_users: Joi.array().items(Joi.string().uuid()).messages({
      "array.base": "Select users must be an array of UUIDs",
      "array.min": "At least one select user is required",
      "array.unique": "Select users must be unique",
      "any.required": "Select users is required",
    }).optional().allow(null),
    notes: Joi.string().max(500),
  }),
};

const getActionSchema = {
  params: Joi.object({
    lead_id: Joi.string().uuid().required().messages({
      "string.guid": "Lead ID must be a valid UUID",
      "any.required": "Lead ID is required",
    }),
  }),
  query: Joi.object({
    filter: Joi.string()
      .valid("all", "notes", "sms", "appointment", "task")
      .default("all"),
  }),
};

module.exports = {
  createActionSchema,
  getActionSchema,
};
