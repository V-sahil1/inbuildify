import Joi from "joi";

const createLeadContactMapSchema = Joi.object({
  leads_id: Joi.string().uuid().required().messages({
    "string.guid": "Leads ID must be a valid UUID",
    "any.required": "Leads ID is required",
  }),
  contact_id: Joi.string().uuid().required().messages({
    "string.guid": "Contact ID must be a valid UUID",
    "any.required": "Contact ID is required",
  }),
});

const getByLeadParamsSchema = Joi.object({
  leads_id: Joi.string().uuid().required().messages({
    "string.guid": "Leads ID must be a valid UUID",
    "any.required": "Leads ID is required",
  }),
});

const deleteParamsSchema = Joi.object({
  id: Joi.string().uuid().required().messages({
    "string.guid": "ID must be a valid UUID",
    "any.required": "ID is required",
  }),
});

export default {
  createLeadContactMapSchema,
  getByLeadParamsSchema,
  deleteParamsSchema,
};
