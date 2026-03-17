import Joi from "joi";

export const createOpportunitySchema = Joi.object({
  lead_id: Joi.string().uuid().required().messages({
    "string.base": "lead_id must be a string",
    "string.guid": "lead_id must be a valid UUID",
    "any.required": "lead_id is required",
  }),
});

export default {
  createOpportunitySchema,
};
