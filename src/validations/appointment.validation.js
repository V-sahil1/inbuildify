const Joi = require("joi");

const createAppointmentSchema = Joi.object({
  title: Joi.string().max(255).required(),

  date: Joi.date().required(),

  start_time: Joi.string()
    .pattern(/^([0-1]\d|2[0-3]):([0-5]\d)$/)
    .required()
    .messages({
      "string.pattern.base": "start_time must be in HH:MM format",
    }),

  end_time: Joi.string()
    .pattern(/^([0-1]\d|2[0-3]):([0-5]\d)$/)
    .required()
    .messages({
      "string.pattern.base": "end_time must be in HH:MM format",
    }),

  location_id: Joi.string().uuid().optional().messages({
    "string.guid": "location ID must be a valid UUID",
  }),

  link_to: Joi.string().uuid().optional().messages({
    "string.guid": "link_to ID must be a valid UUID",
  }),

  select_users: Joi.array().items(Joi.string().uuid()).default([]).messages({
    "string.guid": "users ID must be a valid UUID",
  }),

  notes: Joi.string().max(255).allow(null, ""),
});

const getAllAppointmentSchema = Joi.object({
  title: Joi.string().max(255).optional(),

  date: Joi.date().optional(),

  location_id: Joi.string().uuid().optional().messages({
    "string.guid": "location ID must be a valid UUID",
  }),

  is_deleted: Joi.boolean().optional(),

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

const deleteAppointmentSchema = Joi.object({
  appointment_id: Joi.string().uuid().required().messages({
    "string.guid": "appointment ID must be a valid UUID",
    "any.required": "appointment ID is required",
  }),
});

const updateAppointmentParamsSchema = Joi.object({
  appointment_id: Joi.string().uuid().required().messages({
    "string.guid": "appointment ID must be a valid UUID",
    "any.required": "appointment ID is required",
  }),
});

const updateAppointmentSchema = Joi.object({
  title: Joi.string().max(255).optional(),

  date: Joi.date().optional(),

  start_time: Joi.string()
    .pattern(/^([0-1]\d|2[0-3]):([0-5]\d)$/)
    .optional()
    .messages({
      "string.pattern.base": "start_time must be in HH:MM format",
    }),

  end_time: Joi.string()
    .pattern(/^([0-1]\d|2[0-3]):([0-5]\d)$/)
    .optional()
    .messages({
      "string.pattern.base": "end_time must be in HH:MM format",
    }),

  location_id: Joi.string().uuid().optional().messages({
    "string.guid": "location ID must be a valid UUID",
  }),

  link_to: Joi.string().uuid().optional().messages({
    "string.guid": "link_to ID must be a valid UUID",
  }),

  select_users: Joi.array().items(Joi.string().uuid()).default([]).messages({
    "string.guid": "users ID must be a valid UUID",
  }),

  notes: Joi.string().max(255).allow(null, "").optional(),
});
module.exports = {
  createAppointmentSchema,
  getAllAppointmentSchema,
  deleteAppointmentSchema,
  updateAppointmentParamsSchema,
  updateAppointmentSchema,
};
