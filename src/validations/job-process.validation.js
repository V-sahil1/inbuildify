const Joi = require("joi");

const createJobProcessSchema = Joi.object({
  name: Joi.string().trim().max(200).required().messages({
    "string.empty": "Name is required",
    "string.max": "Name must be at most 200 characters long",
    "any.required": "Name is required",
  }),
  description: Joi.string().max(500).optional().allow("").messages({
    "string.max": "Description must be at most 500 characters long",
  }),
  is_active: Joi.boolean().default(true).optional(),
});

const getJobProcessesSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1).optional().messages({
    "number.base": "Page must be a number",
    "number.integer": "Page must be an integer",
    "number.min": "Page must be at least 1",
  }),
  limit: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(25)
    .optional()
    .messages({
      "number.base": "Limit must be a number",
      "number.integer": "Limit must be an integer",
      "number.min": "Limit must be at least 1",
      "number.max": "Limit must not exceed 100",
    }),
});

const deleteJobProcessSchema = Joi.object({
  id: Joi.string().uuid().required().messages({
    "string.guid": "Job process ID must be a valid UUID",
    "any.required": "Job process ID is required",
  }),
});

const updateJobProcessSchema = Joi.object({
  name: Joi.string().trim().max(200).optional().messages({
    "string.empty": "Name cannot be empty",
    "string.max": "Name must be at most 200 characters long",
  }),
  description: Joi.string().max(500).optional().allow("").messages({
    "string.max": "Description must be at most 500 characters long",
  }),
})
  .min(1)
  .messages({
    "object.min": "At least one field must be provided for update",
  });

const updateJobProcessParamsSchema = Joi.object({
  id: Joi.string().uuid().required().messages({
    "string.guid": "Job process ID must be a valid UUID",
    "any.required": "Job process ID is required",
  }),
});

const toggleJobProcessIsActiveParamsSchema = Joi.object({
  id: Joi.string().uuid().required().messages({
    "string.guid": "Job process ID must be a valid UUID",
    "any.required": "Job process ID is required",
  }),
});

module.exports = {
  createJobProcessSchema,
  getJobProcessesSchema,
  deleteJobProcessSchema,
  updateJobProcessSchema,
  updateJobProcessParamsSchema,
  toggleJobProcessIsActiveParamsSchema,
};
