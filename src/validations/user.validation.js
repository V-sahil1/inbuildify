const Joi = require("joi");

// Common rules
const nameRule = Joi.string()
  .pattern(/^(?=.*[a-zA-Z])[a-zA-Z0-9\s,./#-]+$/)
  .min(2)
  .max(100)
  .required()
  .messages({
    "string.pattern.base":
      "Name can only contain letters, numbers, space, comma, dot, slash, hash, and hyphen.",
    "any.required": "Name is required",
    "string.min": "Name must be at least 2 characters long",
    "string.max": "Name must not exceed 100 characters",
  });
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
  login_id: loginIdRule.optional(),
  role_id: uuidRule.required(),
  phone: phoneRule,
  secondary_phone: phoneRule,
  initials: Joi.string().max(10).allow(null, ""),
  reporting_to: uuidRule.allow(null, ""),
  date_of_joining: Joi.date().allow(null, "").messages({
    "date.base": "Date of joining must be a valid date",
  }),
  date_of_birth: Joi.date().allow(null, "").messages({
    "date.base": "Date of birth must be a valid date",
  }),
  designation: Joi.string()
    .pattern(/^(?=.*[a-zA-Z])[a-zA-Z0-9\s,./#-]+$/)
    .min(2)
    .max(100)
    .allow(null, "")
    .messages({
      "string.pattern.base":
        "Designation can only contain letters, numbers, space, comma, dot, slash, hash, and hyphen.",
      "any.required": "Designation is required",
      "string.min": "Designation must be at least 2 characters long",
      "string.max": "Designation must not exceed 100 characters",
    }),
  remark: Joi.string()
    .pattern(/^(?=.*[a-zA-Z])[a-zA-Z0-9\s,./#-]+$/)
    .allow(null, ""),
  consultant_bio: Joi.string()
    .pattern(/^(?=.*[a-zA-Z])[a-zA-Z0-9\s,./#-]+$/)
    .allow(null, ""),
  use_company_address: Joi.boolean().optional(),
  password_option: Joi.string().valid("auto", "manual"),
  manual_password: Joi.string()
    .min(8)
    .max(255)
    .pattern(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*-])[A-Za-z\d!@#$%^&*-]{8,}$/,
    )
    .optional()
    .messages({
      "string.min": "Password must be at least 8 characters long",
      "string.pattern.base":
        "Password must contain uppercase, lowercase, number, and special character (!@#$%^&*-)",
    }),
  next_login_password_change: Joi.boolean().optional(),
  email_login_credentials: Joi.boolean().optional(),
  builders: Joi.string().allow(null, ""), // JSON array as string
  builder_id: uuidRule.allow(null, ""), // Optional since it comes from token
  address: Joi.when("use_company_address", {
    is: false,
    then: Joi.object().required().messages({
      "any.required": "Address is required when use_company_address is false",
      "object.base": "Address must be an object",
    }),
    otherwise: Joi.object().allow(null),
  }),
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
  next_login_password_change: Joi.boolean().optional(),
  email_password: Joi.boolean().optional(),
});

/* ---------------------------
   CHANGE LOGIN ID
---------------------------- */
const changeLoginIdSchema = Joi.object({
  new_login_id: loginIdRule.required(),
  email_login_id: Joi.boolean().optional(),
});

/* ---------------------------
   GET USERS
---------------------------- */
const getUsersSchema = Joi.object({
  page: Joi.number().min(1).default(1),
  limit: Joi.number().min(1).max(100).default(25),
  search: Joi.string().allow("", null),
  role: Joi.string().allow("", null).max(255).optional(),
  role_id: uuidRule.allow(null, "").optional(),
});

module.exports = {
  createUserSchema,
  updateUserSchema,
  resetPasswordSchema,
  changeLoginIdSchema,
  getUsersSchema,
};
