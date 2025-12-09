const Joi = require("joi");

const createTaskAttachmentSchema = Joi.object({
  task_id: Joi.string().uuid().required().messages({
    "string.guid": "task ID must be a valid UUID",
    "any.required": "task ID is required",
  }),
  file_name: Joi.string().trim().max(255).optional(),
  file_image: Joi.string().max(500).trim().required().messages({
    "string.base": "Image must be a string",
    "string.uri": "Image must be a valid URL",
    "string.max": "Image URL must not exceed 500 characters",
  }),
});

module.exports = { createTaskAttachmentSchema };
