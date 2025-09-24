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
    attachment: Joi.string()
      .uri()
      .max(500)
      .trim()
      .messages({
        "string.base": "Image must be a string",
        "string.uri": "Image must be a valid URL",
        "string.max": "Image URL must not exceed 500 characters",
      })
      .optional(),

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

    recipient: Joi.array()
      .items(Joi.string().uuid())
      .messages({
        "array.base": "Recipient must be an array of UUIDs",
        "array.min": "At least one recipient is required",
        "array.unique": "Recipient must be unique",
        "any.required": "Recipient is required",
      })
      .optional()
      .allow(null),

    title: Joi.string().max(200),
    date: Joi.date(),
    start_time: Joi.string(),
    end_time: Joi.string(),
    location: Joi.string().max(200),
    select_users: Joi.array()
      .items(Joi.string().uuid())
      .messages({
        "array.base": "Select users must be an array of UUIDs",
        "array.min": "At least one select user is required",
        "array.unique": "Select users must be unique",
        "any.required": "Select users is required",
      })
      .optional()
      .allow(null),
    notes: Joi.string().max(500),
  }),
};

const updateActionSchema = {
  params: Joi.object({
    action_id: Joi.string().uuid().required().messages({
      "string.guid": "Action ID must be a valid UUID",
      "any.required": "Action ID is required",
    }),
  }),
  body: Joi.object({
    action_type_id: Joi.string().uuid().required().messages({
      "string.guid": "Action type ID must be a valid UUID",
      "any.required": "Action type ID is required",
    }),
    type: Joi.string().valid("NOTES", "SMS", "APPOINTMENT", "TASK"),

    message: Joi.string().max(500),
    tags: Joi.array().items(Joi.string()),

    attachment: Joi.string().uri().max(500).trim().optional(),
    sendToCustomer: Joi.boolean(),
    createFollowUpTask: Joi.boolean(),

    task: Joi.object({
      name: Joi.string().max(200),
      due_date: Joi.date(),
      priority: Joi.string().valid("HIGH", "LOW", "MEDIUM"),
      time: Joi.string(),
      assignee: Joi.string().uuid(),
      description: Joi.string(),
    }).when("type", {
      is: "TASK",
      then: Joi.required(),
      otherwise: Joi.optional(),
    }),

    recipient: Joi.array()
      .items(Joi.string().uuid())
      .unique()
      .optional()
      .allow(null)
      .when("type", {
        is: "SMS",
        then: Joi.optional(),
        otherwise: Joi.optional(),
      }),

    title: Joi.string()
      .max(200)
      .when("type", { is: "APPOINTMENT", then: Joi.required() }),
    date: Joi.date().when("type", { is: "APPOINTMENT", then: Joi.required() }),
    start_time: Joi.string().when("type", {
      is: "APPOINTMENT",
      then: Joi.required(),
    }),
    end_time: Joi.string().when("type", {
      is: "APPOINTMENT",
      then: Joi.required(),
    }),
    location: Joi.string()
      .max(200)
      .when("type", { is: "APPOINTMENT", then: Joi.required() }),
    select_users: Joi.array().items(Joi.string().uuid()).optional().allow(null),
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
  updateActionSchema,
  getActionSchema,
};
