const Joi = require("joi");

const createConstructionStageSchema = Joi.object({
  builder: Joi.string().uuid().required().messages({
    "string.guid": "builder ID must be a valid UUID",
    "any.required": "builder ID is required",
  }),

  construction_type_id: Joi.string().uuid().required().messages({
    "string.guid": "construction type ID must be a valid UUID",
    "any.required": "construction type ID is required",
  }),
  stage_name: Joi.string()
    .trim()
    .min(2)
    .max(255)
    .pattern(/^(?=.*[a-zA-Z])[a-zA-Z0-9\s,./#-]+$/)
    .required(),
  days: Joi.number().integer().min(1).max(365),
  sort_order: Joi.number().integer().min(1).default(1).optional(),
  site_image: Joi.boolean().default(false),
  inspection: Joi.string()
    .trim()
    .max(100)
    .valid("not_required", "stage_start", "stage_completed")
    .default("not_required")
    .optional(),
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
});

const getAllConstructionStageSchema = Joi.object({
  builder: Joi.string().uuid().optional().messages({
    "string.guid": "builder ID must be a valid UUID",
  }),

  construction_type_id: Joi.string().uuid().optional().messages({
    "string.guid": "construction type ID must be a valid UUID",
  }),

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

const deleteConstructionStageSchema = Joi.object({
  construction_stage: Joi.string().uuid().optional().messages({
    "string.guid": "construction stage ID must be a valid UUID",
  }),
});

const updateConstructionStageParamsSchema = Joi.object({
  construction_stage: Joi.string().uuid().optional().messages({
    "string.guid": "construction stage ID must be a valid UUID",
  }),
});

const updateConstructionStageSchema = Joi.object({
  stage_name: Joi.string()
    .trim()
    .min(2)
    .max(255)
    .pattern(/^(?=.*[a-zA-Z])[a-zA-Z0-9\s,./#-]+$/)
    .optional(),
  days: Joi.number().integer().min(1).max(365).optional(),
  sort_order: Joi.number().integer().min(1).default(1).optional(),
  site_image: Joi.boolean().optional(),
  inspection: Joi.string()
    .trim()
    .max(100)
    .valid("not_required", "stage_start", "stage_completed")
    .default("not_required")
    .optional(),
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
});
module.exports = {
  createConstructionStageSchema,
  getAllConstructionStageSchema,
  deleteConstructionStageSchema,
  updateConstructionStageParamsSchema,
  updateConstructionStageSchema,
};
