const Joi = require("joi");

const createJobSchema = {
  params: Joi.object({
    lead_id: Joi.string().uuid().required().messages({
      "string.guid": "Lead ID must be a valid UUID",
      "any.required": "Lead ID is required",
    }),
  }),
  body: Joi.object({
    message: Joi.string().max(1000).required().messages({
      "string.empty": "Message is required",
      "string.max": "Message must be at most 1000 characters long",
      "any.required": "Message is required",
    }),
    status: Joi.string().valid("WON", "LOST").required().messages({
      "string.empty": "Status is required",
      "string.valid": "Status must be 'WON' or 'LOST'",
      "any.required": "Status is required",
    }),
  }),
};

module.exports = {
  createJobSchema
};
