const Joi = require("joi");

const nameRule = Joi.string().min(2).max(100).trim().required().messages({
  "string.base": "Name must be a string",
  "string.empty": "Name is required",
  "string.min": "Name must be at least 2 characters long",
  "string.max": "Name must not exceed 100 characters",
  "any.required": "Name is required",
});

const emailRule = Joi.string().email().lowercase().trim().max(150).optional().allow(null, "").messages({
  "string.email": "Please provide a valid email address",
  "string.max": "Email must not exceed 150 characters",
});

const phoneRule = Joi.string()
  .pattern(/^[0-9]{10,15}$/)
  .optional()
  .allow(null, "")
  .messages({
    "string.pattern.base": "Phone must contain only digits and be 10-15 characters long",
  });

const createLeadSchema = Joi.object({
  lead_source: Joi.string().required().messages({
    "string.base": "Lead source must be a string",
    "any.required": "Lead source is required"
  }),
  notes: Joi.string().max(1000).optional().allow(null, ""),
  contact: Joi.object({
    name: nameRule,
    email: emailRule,
    phone: phoneRule,
    secondary_phone: phoneRule.optional(),
    address1: Joi.string().max(255).optional().allow(null, ""),
    address2: Joi.string().max(255).optional().allow(null, ""),
    city: Joi.string().max(100).optional().allow(null, ""),
    zip: Joi.string().max(20).optional().allow(null, ""),
    country: Joi.string().max(100).optional().allow(null, ""),
    state: Joi.string().max(100).optional().allow(null, "")
  }).required().messages({
    "object.base": "Contact must be an object",
    "any.required": "Contact is required"
  })
});

const getLeadByIdSchema = Joi.object({
  lead_id: Joi.string().uuid().required().messages({
    "string.guid": "Lead ID must be a valid UUID",
    "any.required": "Lead ID is required"
  }),
});

const updateLeadSchema = {
  params: Joi.object({
    lead_id: Joi.string().uuid().required().messages({
      "string.guid": "Lead ID must be a valid UUID",
      "any.required": "Lead ID is required"
    }),
  }),
  body: Joi.object({
    lead_source: Joi.string().optional().messages({
      "string.base": "Lead source must be a string"
    }),
    notes: Joi.string().max(1000).optional().allow(null, ""),
    assignee_id: Joi.string().uuid().optional().messages({
      "string.guid": "Assignee ID must be a valid UUID"
    }),
  }).min(1).messages({
    "object.min": "At least one field (lead_source, notes, assignee_id) must be provided"
  }),
};

module.exports = {
  createLeadSchema,
  getLeadByIdSchema,
  updateLeadSchema,
};
