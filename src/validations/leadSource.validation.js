const Joi = require("joi");

const nameRule = Joi.string()
  .min(2)
  .max(100)
  .trim()
  .pattern(/^[a-zA-Z0-9\s&.,()-]+$/)
  .messages({
    "string.base": "Lead source name must be a string",
    "string.empty": "Lead source name is required",
    "string.min": "Lead source name must be at least 2 characters long",
    "string.max": "Lead source name must not exceed 100 characters",
    "string.pattern.base":
      "Lead source name can only contain letters, numbers, spaces, &, ., ,, (, ), and -",
    "any.required": "Lead source name is required",
  });

const leadSourceIdRule = Joi.string().uuid().messages({
  "string.base": "Lead source ID must be a string",
  "string.empty": "Lead source ID is required",
  "string.guid": "Lead source ID must be a valid UUID",
  "any.required": "Lead source ID is required",
});

const createLeadSourceSchema = Joi.object({
  name: nameRule.required(),
});

const getLeadSourceByIdSchema = Joi.object({
  lead_source_id: leadSourceIdRule.required(),
});

const updateLeadSourceSchema = Joi.object({
  name: nameRule.required(),
});

const updateLeadSourceParamsSchema = Joi.object({
  lead_source_id: leadSourceIdRule.required(),
});

const deleteLeadSourceSchema = Joi.object({
  lead_source_id: leadSourceIdRule.required(),
});

module.exports = {
  createLeadSourceSchema,
  getLeadSourceByIdSchema,
  updateLeadSourceSchema,
  updateLeadSourceParamsSchema,
  deleteLeadSourceSchema,
};
