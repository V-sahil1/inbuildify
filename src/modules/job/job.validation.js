const Joi = require("joi");

const convertOpportunitySchema = {
  params: Joi.object({
    opportunity_id: Joi.string().uuid().required().messages({
      "string.guid": "Opportunity ID must be a valid UUID",
      "any.required": "Opportunity ID is required",
    }),
  }),
  body: Joi.object({
    out_come: Joi.string().valid("won", "lost").required().messages({
      "any.only": "Outcome must be 'won' or 'lost'",
      "any.required": "Outcome is required",
    }),
    quotation_version_id: Joi.string()
      .uuid()
      .when("out_come", {
        is: "won",
        then: Joi.required().messages({
          "any.required": "Quotation version ID is required when status is WON",
          "string.guid": "Quotation version ID must be a valid UUID",
        }),
        otherwise: Joi.forbidden(),
      }),
    job_note: Joi.string().max(1000).optional().allow(null, "").messages({
      "string.max": "Job note must not exceed 1000 characters",
    }),
    send_email: Joi.boolean()
      .when("out_come", {
        is: "won",
        then: Joi.optional().default(false),
        otherwise: Joi.forbidden(),
      }),
  }),
};

module.exports = {
  convertOpportunitySchema,
};
