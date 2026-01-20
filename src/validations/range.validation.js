const Joi = require("joi");

const createRangeSchema = Joi.object({
  name: Joi.string().max(150).required().messages({
    "string.base": "Name must be text",
    "string.empty": "Name is required",
    "any.required": "Name is required",
  }),

  logo_url: Joi.string().uri().allow(null, "").messages({
    "string.uri": "Logo URL must be a valid URL",
  }),

  header_url: Joi.string().max(500).allow(null, "").optional(),

  user_id: Joi.array().items(Joi.string().uuid()).default([]),

  sort_order: Joi.number().integer().min(1).allow(null).messages({
    "number.base": "Sort order must be a number",
    "number.min": "Sort order must be at least 1",
  }),

  bg_color: Joi.string()
    .trim()
    .pattern(/^#([0-9A-F]{3}|[0-9A-F]{6})$/i)
    .optional()
    .allow(null)
    .messages({
      "string.pattern.base":
        "Enter valid background color in HEX format (e.g., #FF5733)",
    }),

  font_color: Joi.string()
    .trim()
    .pattern(/^#([0-9A-F]{3}|[0-9A-F]{6})$/i)
    .optional()
    .allow(null)
    .messages({
      "string.pattern.base":
        "Enter valid font color in HEX format (e.g., #FFF453)",
    }),

  is_active: Joi.boolean().default(true),
});

const updateRangeParamsSchema = Joi.object({
  range_id: Joi.string().uuid().required().messages({
    "string.guid": "Range ID must be a valid UUID",
    "any.required": "Range ID is required",
  }),
});

const updateRangeSchema = Joi.object({
  name: Joi.string().max(150).optional().messages({
    "string.base": "Name must be text",
    "string.empty": "Name can not be empty",
  }),

  logo_url: Joi.string().uri().allow(null, "").optional().messages({
    "string.uri": "Logo URL must be a valid URL",
  }),

  header_url: Joi.string().max(500).allow(null, "").optional(),

  user_id: Joi.array().items(Joi.string().uuid()).default([]).optional(),

  sort_order: Joi.number().integer().min(1).allow(null).optional().messages({
    "number.base": "Sort order must be a number",
    "number.min": "Sort order must be at least 1",
  }),

  bg_color: Joi.string()
    .trim()
    .pattern(/^#([0-9A-F]{3}|[0-9A-F]{6})$/i)
    .optional()
    .allow(null)
    .messages({
      "string.pattern.base":
        "Enter valid background color in HEX format (e.g., #FF5733)",
    }),

  font_color: Joi.string()
    .trim()
    .pattern(/^#([0-9A-F]{3}|[0-9A-F]{6})$/i)
    .optional()
    .allow(null)
    .messages({
      "string.pattern.base":
        "Enter valid font color in HEX format (e.g., #FFF453)",
    }),
})
  .min(1)
  .messages({
    "object.min": "At least one field is required to update",
  });

const deleteRangeSchema = {
  params: Joi.object({
    range_id: Joi.string().uuid().required().messages({
      "string.guid": "Range ID must be a valid UUID",
      "any.required": "Range ID is required",
    }),
  }),
};

const updateRangeActiveSchema = Joi.object({
  is_active: Joi.boolean().required(),
});

module.exports = {
  createRangeSchema,
  updateRangeParamsSchema,
  updateRangeSchema,
  deleteRangeSchema,
  updateRangeActiveSchema,
};
