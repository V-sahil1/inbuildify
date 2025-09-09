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
    attachment: Joi.string().optional(),

    sendToCustomer: Joi.boolean().default(false),
    createFollowUpTask: Joi.boolean().default(false),

    task: Joi.object({
      name: Joi.string().max(200).required(),
      due_date: Joi.date().required(),
      priority: Joi.string().valid("HIGH", "LOW", "MEDIUM").required(),
      description: Joi.string().optional(),
    }).when("createFollowUpTask", {
      is: true,
      then: Joi.required(),
      otherwise: Joi.optional(),
    }),

    recipient: Joi.array().items(Joi.string().uuid()),

    title: Joi.string().max(200),
    date: Joi.date(),
    start_time: Joi.string(),
    end_time: Joi.string(),
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
