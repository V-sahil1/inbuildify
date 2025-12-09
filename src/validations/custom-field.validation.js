const Joi = require("joi");

const createCustomFieldSchema = Joi.object({
  module_id: Joi.string().uuid().required().messages({
    "string.guid": "Custom field module ID must be a valid UUID",
    "any.required": "Custom field module ID is required",
  }),
  field_name: Joi.string().trim().min(2).max(150).required().messages({
    "string.empty": "Field name is required.",
    "any.required": "Field name is required.",
  }),
  field_label: Joi.string().trim().min(2).max(150).required().messages({
    "string.empty": "Field label is required.",
    "any.required": "Field label is required.",
  }),

  field_type: Joi.string()
    .valid("text", "number", "date", "checkbox", "list", "multiline")
    .required()
    .messages({
      "any.only":
        "Invalid field_type. Must be one of: text, number, date, checkbox, list, multiline.",
      "any.required": "Field type is required.",
    }),
  options: Joi.when("field_type", {
    is: "list",
    then: Joi.array()
      .items(
        Joi.string().trim().min(1).messages({
          "string.empty": "Option cannot be empty.",
        })
      )
      .min(1)
      .required()
      .messages({
        "array.base": "Options must be an array.",
        "array.min": "At least one option is required for list field type.",
        "any.required":
          "Options are required and must be a non-empty array for list field type.",
      }),
    otherwise: Joi.forbidden(),
  }),

  is_required: Joi.boolean().default(false),

  sort_order: Joi.number().integer().min(1).default(0),

  is_active: Joi.boolean().default(true),
});

const getAllCustomFieldSchema = Joi.object({
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

const deleteCustomFieldSchema = Joi.object({
  id: Joi.string().uuid().required().messages({
    "string.guid": "Custom field ID must be a valid UUID",
    "any.required": "Custom field ID is required",
  }),
});

const updateCustomFieldIdParamsSchema = Joi.object({
  id: Joi.string().uuid().required().messages({
    "string.guid": "Custom field ID must be a valid UUID",
    "any.required": "Custom field ID is required",
  }),
});

const updateCustomFieldSchema = Joi.object({
  field_name: Joi.string().trim().max(150).optional(),

  field_label: Joi.string().trim().max(150).optional(),

  field_type: Joi.string()
    .valid("text", "number", "date", "checkbox", "list", "multiline")
    .optional(),

  options: Joi.alternatives()
    .conditional("field_type", {
      is: "list",
      then: Joi.array().items(Joi.string().trim().min(1)).min(1).required(),
      otherwise: Joi.forbidden(),
    })
    .optional(),

  is_required: Joi.boolean().default(false).optional(),

  sort_order: Joi.number().integer().min(1).optional(),

  is_active: Joi.boolean().default(true).optional(),
});
module.exports = {
  createCustomFieldSchema,
  getAllCustomFieldSchema,
  deleteCustomFieldSchema,
  updateCustomFieldIdParamsSchema,
  updateCustomFieldSchema,
};
