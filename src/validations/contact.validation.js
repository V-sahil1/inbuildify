const Joi = require("joi");

/* ============================================================
    COMMON RULES
============================================================ */

const uuidRule = Joi.string()
  .guid({ version: ["uuidv4", "uuidv1"] })
  .messages({ "string.guid": "Invalid UUID format." });

const nameRule = Joi.string()
  .min(2)
  .max(100)
  .required()
  .messages({
    "string.base": "Name must be a string",
    "string.min": "Name must be at least 2 characters",
    "string.max": "Name must not exceed 100 characters",
    "any.required": "Name is required"
  });

const emailRule = Joi.string()
  .email()
  .trim()
  .lowercase()
  .required()
  .messages({
    "string.email": "Email must be valid",
    "any.required": "Email is required"
  });

const phoneRule = Joi.string()
  .pattern(/^[0-9]{8,15}$/)
  .allow(null, "")
  .messages({
    "string.pattern.base": "Phone must be 8–15 digits only"
  });

const remarkRule = Joi.string().allow(null, "").max(500);

const addressJsonRule = Joi.string()
  .allow(null, "")
  .custom((value, helpers) => {
    if (!value) return value;
    try {
      const obj = JSON.parse(value);

      const addressSchema = Joi.object({
        address_line1: Joi.string().max(255).required(),
        address_line2: Joi.string().max(255).allow("", null),
        city: Joi.string().max(100).allow("", null),
        zip_code: Joi.string().max(20).allow("", null),
        country_id: uuidRule.allow(null),
        state_id: uuidRule.allow(null)
      });

      const { error } = addressSchema.validate(obj);
      if (error) return helpers.error("any.invalid");
      return value;
    } catch (e) {
      return helpers.error("any.invalid");
    }
  })
  .messages({
    "any.invalid": "Address must be a valid JSON object with correct fields"
  });

/* ============================================================
    CREATE CONTACT
============================================================ */

const createContactSchema = Joi.object({
  name: nameRule,
  email: emailRule,
  phone: phoneRule,
  secondary_phone: phoneRule,
  remark: remarkRule,
  role_id: uuidRule.required(),
  address: addressJsonRule
});

/* ============================================================
    UPDATE CONTACT
============================================================ */

const updateContactSchema = Joi.object({
  name: nameRule.optional(),
  email: emailRule.optional(),
  phone: phoneRule.optional(),
  secondary_phone: phoneRule.optional(),
  remark: remarkRule.optional(),
  role_id: uuidRule.optional(),
  address: addressJsonRule.optional()
});

/* ============================================================
    CONVERT CONTACT → USER
============================================================ */

const convertContactSchema = Joi.object({
  role_id: uuidRule.required().messages({
    "any.required": "Role ID is required to convert a contact into a user."
  })
});

/* ============================================================
    GET CONTACT LIST
============================================================ */

const getContactsSchema = Joi.object({
  page: Joi.number().min(1).default(1),
  limit: Joi.number().min(1).max(100).default(25),
  search: Joi.string().allow("", null)
});

module.exports = {
  createContactSchema,
  updateContactSchema,
  convertContactSchema,
  getContactsSchema
};
