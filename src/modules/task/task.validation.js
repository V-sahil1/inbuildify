const Joi = require("joi");

const createTaskSchema = Joi.object({
  name: Joi.string()
    .min(2)
    .max(200)
    .pattern(/^(?=.*[a-zA-Z])[a-zA-Z0-9\s,./#-]+$/)
    .required(),

  description: Joi.string().allow(null, "").optional(),

  due_date: Joi.date()
    .greater("now")
    .messages({
      "date.greater": "Due date must be a future date",
      "date.base": "Due date must be a valid date",
    })
    .allow(null),

  due_time: Joi.string()
    .pattern(/^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/) // HH:mm or HH:mm:ss
    .allow(null, "")
    .optional()
    .messages({
      "string.pattern.base":
        "Due time must be in HH:MM format OR due time must be valid",
    }),

  assignee_id: Joi.string().uuid().allow(null).optional(),

  link_to: Joi.string().uuid().allow(null).optional().messages({
    "string.uuid": "Link to must be a valid UUID",
  }),

  link_type: Joi.string().min(2).max(255).optional(),

  priority: Joi.string()
    .max(20)
    .valid("Low", "Medium", "High")
    .default("Medium"),

  status: Joi.string()
    .max(20)
    .valid("Yet to Start", "In Progress", "Completed", "Cancelled", "Skipped")
    .default("Yet to Start"),

  attach_files: Joi.string().max(500).allow(null, "").optional(),
});

const getAllTaskSchema = Joi.object({
  name: Joi.string().max(200).optional(),

  due_date: Joi.date()
    .allow(null)
    .greater("now")
    .messages({
      "date.greater": "Due date must be a future date",
      "date.base": "Due date must be a valid date",
    })
    .optional(),

  assignee_id: Joi.string().uuid().allow(null).optional(),

  link_to: Joi.string().uuid().allow(null).optional().messages({
    "string.uuid": "Link to must be a valid UUID",
  }),

  link_type: Joi.string().max(255).allow(null, "").optional(),

  priority: Joi.string().max(20).valid("Low", "Medium", "High").optional(),

  status: Joi.string()
    .max(20)
    .valid("Yet to Start", "In Progress", "Completed", "Cancelled", "Skipped")
    .optional(),

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

const deleteTaskSchema = Joi.object({
  task_id: Joi.string().uuid().required().messages({
    "string.guid": "task ID must be a valid UUID",
    "any.required": "task ID is required",
  }),
});

const updateTaskParamsSchema = Joi.object({
  task_id: Joi.string().uuid().required().messages({
    "string.guid": "task ID must be a valid UUID",
    "any.required": "task ID is required",
  }),
});

const updateTaskSchema = Joi.object({
  name: Joi.string()
    .min(2)
    .max(200)
    .pattern(/^(?=.*[a-zA-Z])[a-zA-Z0-9\s,./#-]+$/)
    .optional(),

  description: Joi.string().allow(null, "").optional(),

  due_date: Joi.date()
    .greater("now")
    .messages({
      "date.greater": "Due date must be a future date",
      "date.base": "Due date must be a valid date",
    })
    .optional()
    .allow(null),

  due_time: Joi.string()
    .pattern(/^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/) // HH:mm or HH:mm:ss
    .allow(null, "")
    .optional()
    .messages({
      "string.pattern.base":
        "Due time must be in HH:MM format OR due time must be valid",
    }),

  assignee_id: Joi.string().uuid().allow(null).optional(),

  link_to: Joi.string().uuid().allow(null).optional().messages({
    "string.uuid": "Link to must be a valid UUID",
  }),

  link_type: Joi.string().max(255).allow(null, "").optional(),

  priority: Joi.string().max(20).valid("Low", "Medium", "High").optional(),

  status: Joi.string()
    .max(20)
    .valid("Yet to Start", "In Progress", "Completed", "Cancelled", "Skipped")
    .optional(),

  attach_files: Joi.string().max(500).allow(null, "").optional(),
});

module.exports = {
  createTaskSchema,
  getAllTaskSchema,
  deleteTaskSchema,
  updateTaskParamsSchema,
  updateTaskSchema,
};
