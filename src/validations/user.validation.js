const Joi = require("joi");

// Common rules
const nameRule = Joi.string().min(2).max(100).required();
const emailRule = Joi.string().email().lowercase().trim().required();
const phoneRule = Joi.string()
  .pattern(/^[0-9]{8,15}$/)
  .allow(null, "");

const loginIdRule = Joi.string()
  .pattern(/^[A-Za-z0-9._@-]+$/)
  .messages({
    "string.pattern.base":
      "Login ID can only contain letters, numbers, dot, underscore, hyphen, and @.",
  });

const uuidRule = Joi.string()
  .guid({ version: "uuidv4" })
  .messages({ "string.guid": "Invalid UUID format." });

/* ---------------------------
   CREATE USER
---------------------------- */
const createUserSchema = Joi.object({
  name: nameRule,
  email: emailRule,
  login_id: loginIdRule.allow(null, ""),
  role_id: uuidRule.required(),
  phone: phoneRule,
  secondary_phone: phoneRule,
  initials: Joi.string().max(10).allow(null, ""),
  reporting_to: uuidRule.allow(null, ""),
  date_of_joining: Joi.date().allow(null, ""),
  date_of_birth: Joi.date().allow(null, ""),
  designation: Joi.string().max(100).allow(null, ""),
  remark: Joi.string().allow(null, ""),
  consultant_bio: Joi.string().allow(null, ""),
  use_builder_address: Joi.boolean().truthy("true").falsy("false"),
  password_option: Joi.string().valid("auto", "manual"),
  manual_password: Joi.string().allow(null, ""),
  next_login_password_change: Joi.boolean().truthy("true").falsy("false"),
  email_login_credentials: Joi.boolean().truthy("true").falsy("false"),
  builders: Joi.string().allow(null, ""), // JSON array as string
  builder_id: uuidRule.required().allow(null, ""), // Single builder ID instead of array
  address: Joi.string().allow(null, ""), // JSON as string
  photo: Joi.string().allow("", null).optional(),
  signature: Joi.string().allow("", null).optional(),
});

/* ---------------------------
   UPDATE USER
---------------------------- */
const updateUserSchema = createUserSchema.fork(
  ["name", "email", "role_id"],
  (schema) => schema.optional(),
);

/* ---------------------------
   RESET PASSWORD
---------------------------- */
const resetPasswordSchema = Joi.object({
  password_option: Joi.string().valid("auto", "manual").required(),
  manual_password: Joi.string().allow(null, ""),
  next_login_password_change: Joi.boolean().truthy("true").falsy("false"),
  email_password: Joi.boolean().truthy("true").falsy("false"),
});

/* ---------------------------
   CHANGE LOGIN ID
---------------------------- */
const changeLoginIdSchema = Joi.object({
  new_login_id: loginIdRule.required(),
  email_login_id: Joi.boolean().truthy("true").falsy("false"),
});

/* ---------------------------
   GET USERS
---------------------------- */
const getUsersSchema = Joi.object({
  page: Joi.number().min(1).default(1),
  limit: Joi.number().min(1).max(100).default(25),
  search: Joi.string().allow("", null),
  role: Joi.string().allow("", null).max(255).optional(),
});

module.exports = {
  createUserSchema,
  updateUserSchema,
  resetPasswordSchema,
  changeLoginIdSchema,
  getUsersSchema,
};
