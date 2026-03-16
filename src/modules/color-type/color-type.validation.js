import Joi from "joi";

const createColorTypeSchema = Joi.object({
  color_type_name: Joi.string()
    .trim()
    .min(2)
    .max(255)
    .required()
    .pattern(/^(?=.*[a-zA-Z])[a-zA-Z0-9\s,./#-]+$/)
    .messages({
      "any.required": "Color type name is required",
      "string.empty": "Color type name cannot be empty",
      "string.min": "Color type name must be at least 2 characters long",
      "string.max": "Color type name must not exceed 255 characters",
      "string.pattern.base":
        "Color type name must contain at least one letter and can only contain letters, numbers, spaces, and ./#- characters",
    }),
});

const updateColorTypeSchema = Joi.object({
  color_type_name: Joi.string()
    .trim()
    .min(2)
    .max(255)
    .optional()
    .pattern(/^(?=.*[a-zA-Z])[a-zA-Z0-9\s,./#-]+$/)
    .messages({
      "string.empty": "Color type name cannot be empty",
      "string.min": "Color type name must be at least 2 characters long",
      "string.max": "Color type name must not exceed 255 characters",
      "string.pattern.base":
        "Color type name must contain at least one letter and can only contain letters, numbers, spaces, and ./#- characters",
    }),
})
  .min(1)
  .message({
    "object.min": "At least one field must be provided for update",
  });

const paramsIdSchema = Joi.object({
  id: Joi.string().uuid().required().messages({
    "string.guid": "ID must be a valid UUID",
    "any.required": "ID is required",
  }),
});

export default {
  createColorTypeSchema,
  updateColorTypeSchema,
  paramsIdSchema,
};
