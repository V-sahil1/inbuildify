const Joi = require("joi");

const phoneRule = Joi.string()
  .pattern(/^[0-9]{10,15}$/)
  .optional()
  .allow(null, "")
  .messages({
    "string.pattern.base": "Phone must contain only digits and be 10-15 characters long",
  });

const createLeadContactSchema = {
  params: Joi.object({
    lead_id: Joi.string().uuid().required(),
  }),
  body: Joi.object({
    name: Joi.string().min(2).max(100).required(),
    email: Joi.string().email().max(150).optional().allow(null, ""),
    phone: phoneRule,
    secondary_phone: phoneRule,
    address1: Joi.string().max(255).optional().allow(null, ""),
    address2: Joi.string().max(255).optional().allow(null, ""),
    city: Joi.string().max(100).optional().allow(null, ""),
    zip: Joi.string().max(20).optional().allow(null, ""),
    country: Joi.string().max(100).optional().allow(null, ""),
    state: Joi.string().max(100).optional().allow(null, ""),
  }).required().messages({
    "object.base": "Contact must be an object",
    "any.required": "Contact is required"
  }),
};

const updateLeadContactSchema = {
  params: Joi.object({
    lead_contact_id: Joi.string().uuid().required(),
  }),
  body: Joi.object({
    name: Joi.string().min(2).max(100),
    email: Joi.string().email().max(150).optional().allow(null, ""),
    phone: phoneRule,
    secondary_phone: phoneRule,
    address1: Joi.string().max(255).optional().allow(null, ""),
    address2: Joi.string().max(255).optional().allow(null, ""),
    city: Joi.string().max(100).optional().allow(null, ""),
    zip: Joi.string().max(20).optional().allow(null, ""),
    country: Joi.string().max(100).optional().allow(null, ""),
    state: Joi.string().max(100).optional().allow(null, ""),
  }).min(1),
};

module.exports = {
  createLeadContactSchema,
  updateLeadContactSchema,
};
