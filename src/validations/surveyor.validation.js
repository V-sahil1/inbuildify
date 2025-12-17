const Joi = require("joi");

const createSurveyorSchema = Joi.object({
  name: Joi.string().trim().max(150).required().messages({
    "string.base": "Name must be a string.",
    "string.max": "Name cannot exceed 150 characters.",
    "any.required": "Name is required.",
  }),

  email: Joi.string()
    .trim()
    .email()
    .max(150)
    .allow(null, "")
    .optional()
    .messages({
      "string.email": "Email must be a valid email address.",
      "string.max": "Email cannot exceed 150 characters.",
    }),
  phone: Joi.string()
    .trim()
    .min(10)
    .max(50)
    .allow(null, "")
    .optional()
    .messages({
      "string.max": "Phone cannot exceed 50 characters.",
    }),
  abn_number: Joi.string()
    .trim()
    .min(11)
    .max(20)
    .allow(null, "")
    .optional()
    .messages({
      "string.max": "ABN number cannot exceed 20 characters.",
    }),
  registration_number: Joi.string()
    .trim()
    .max(100)
    .allow(null, "")
    .optional()
    .messages({
      "string.max": "Registration number cannot exceed 100 characters.",
    }),
  address1: Joi.string().trim().max(255).required(),
  address2: Joi.string().trim().max(255).optional(),
  city: Joi.string().trim().max(150).required(),
  state_id: Joi.string().uuid().required().messages({
    "string.guid": "state ID must be a valid UUID",
  }),
  zip_postal_code: Joi.string().trim().max(20).required(),
});

const getAllServeyorSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1).messages({
    "number.base": "Page must be a number",
    "number.integer": "Page must be an integer",
    "number.min": "Page must be greater than 0",
  }),

  limit: Joi.number().integer().min(1).max(100).default(10).messages({
    "number.base": "Limit must be a number",
    "number.integer": "Limit must be an integer",
    "number.min": "Limit must be at least 1",
    "number.max": "Limit must not exceed 100",
  }),
});

const deleteSurveyorSchema = Joi.object({
  surveyor_id: Joi.string().uuid().required().messages({
    "string.guid": "Surveyor ID must be a valid UUID",
    "any.required": "Surveyor ID is required",
  }),
});

const updateSurveyorIdParamsSchema = Joi.object({
  surveyor_id: Joi.string().uuid().required().messages({
    "string.guid": "Surveyor ID must be a valid UUID",
    "any.required": "Surveyor ID is required",
  }),
});

const updateSurveyorSchema = Joi.object({
  name: Joi.string().trim().max(150).optional().messages({
    "string.base": "Name must be a string.",
    "string.max": "Name cannot exceed 150 characters.",
  }),
  email: Joi.string()
    .trim()
    .email()
    .max(150)
    .allow(null, "")
    .optional()
    .messages({
      "string.email": "Email must be a valid email address.",
      "string.max": "Email cannot exceed 150 characters.",
    }),
  phone: Joi.string()
    .trim()
    .min(10)
    .max(50)
    .allow(null, "")
    .optional()
    .messages({
      "string.max": "Phone cannot exceed 50 characters.",
    }),
  abn_number: Joi.string()
    .trim()
    .min(11)
    .max(20)
    .allow(null, "")
    .optional()
    .messages({
      "string.max": "ABN number cannot exceed 20 characters.",
    }),
  registration_number: Joi.string()
    .trim()
    .max(100)
    .allow(null, "")
    .optional()
    .messages({
      "string.max": "Registration number cannot exceed 100 characters.",
    }),
  address1: Joi.string().trim().max(255).optional(),
  address2: Joi.string().trim().max(255).optional(),
  city: Joi.string().trim().max(150).optional(),
  state_id: Joi.string().uuid().optional().messages({
    "string.guid": "state ID must be a valid UUID",
  }),
  zip_postal_code: Joi.string().trim().max(20).optional(),
});

module.exports = {
  createSurveyorSchema,
  getAllServeyorSchema,
  deleteSurveyorSchema,
  updateSurveyorIdParamsSchema,
  updateSurveyorSchema,
};
