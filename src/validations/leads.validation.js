const Joi = require("joi");

// Reusable rules
const nameRule = Joi.string().min(2).max(100).trim().required().messages({
  "string.base": "Name must be a string",
  "string.empty": "Name is required",
  "string.min": "Name must be at least 2 characters long",
  "string.max": "Name must not exceed 100 characters",
  "any.required": "Name is required",
});

const emailRule = Joi.string().email().lowercase().trim().max(150).required().messages({
  "string.base": "Email must be a string",
  "string.empty": "Email is required",
  "string.email": "Please provide a valid email address",
  "string.max": "Email must not exceed 150 characters",
  "any.required": "Email is required",
});

const phoneRule = Joi.string()
  .pattern(/^[0-9]{10,15}$/)
  .optional()
  .allow("")
  .messages({
    "string.base": "Phone must be a string",
    "string.pattern.base": "Phone must contain only digits and be 10-15 characters long",
  });

const builderIdRule = Joi.string().uuid().optional().allow(null).messages({
  "string.base": "Builder ID must be a string",
  "string.guid": "Builder ID must be a valid UUID",
});

const leadSourceRule = Joi.string()
  .valid(
    "ADMIN_PANEL",
    "WEBSITE",
    "INSTAGRAM",
    "FACEBOOK",
    "YOUTUBE",
    "LINKEDIN",
    "TWITTER",
    "TIKTOK",
    "WHATSAPP",
    "EMAIL_CAMPAIGN",
    "GOOGLE_ADS",
    "FACEBOOK_ADS",
    "INSTAGRAM_ADS",
    "YOUTUBE_ADS",
    "LINKEDIN_ADS",
    "REFERRAL",
    "PHONE_CALL",
    "TRADE_SHOW",
    "PARTNER",
    "OTHER"
  )
  .default("OTHER")
  .messages({
    "string.base": "Lead source must be a string",
    "any.only":
      "Lead source must be one of: ADMIN_PANEL, WEBSITE, INSTAGRAM, FACEBOOK, YOUTUBE, LINKEDIN, TWITTER, TIKTOK, WHATSAPP, EMAIL_CAMPAIGN, GOOGLE_ADS, FACEBOOK_ADS, INSTAGRAM_ADS, YOUTUBE_ADS, LINKEDIN_ADS, REFERRAL, PHONE_CALL, TRADE_SHOW, PARTNER, OTHER",
  });

// Schemas
const createLeadSchema = Joi.object({
  name: nameRule,
  email: emailRule,
  phone: phoneRule,
  builderId: builderIdRule,
  leadSource: leadSourceRule,
});

const getLeadByIdSchema = Joi.object({
  id: Joi.string().uuid().required().messages({
    "string.base": "Lead ID must be a string",
    "string.empty": "Lead ID is required",
    "string.guid": "Lead ID must be a valid UUID",
    "any.required": "Lead ID is required",
  }),
});

module.exports = {
  createLeadSchema,
  getLeadByIdSchema,
};
