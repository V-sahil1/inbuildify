const Joi = require("joi");

const createNoteTageSchema = Joi.object({
  name: Joi.string().trim().min(3).max(100).required().messages({
    "string.empty": "Tag name is required.",
  }),
  background_color: Joi.string()
    .trim()
    .max(20)
    .pattern(/^#([0-9A-F]{3}|[0-9A-F]{6})$/i)
    .optional()
    .allow(null)
    .messages({
      "string.pattern.base":
        "Enter valid background color in HEX format (e.g., #FF5733)",
    }),
  font_color: Joi.string()
    .trim()
    .max(20)
    .pattern(/^#([0-9A-F]{3}|[0-9A-F]{6})$/i)
    .optional()
    .allow(null)
    .messages({
      "string.pattern.base":
        "Enter valid font color in HEX format (e.g., #FFF453)",
    }),

  is_active: Joi.boolean().default(true),
});

const getAllNoteTagSchema = Joi.object({
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

const updateNoteTagIdParamsSchema = Joi.object({
  id: Joi.string().uuid().required().messages({
    "string.guid": "Note tag ID must be a valid UUID",
    "any.required": "Note tag ID is required",
  }),
});

const deleteNoteTagSchema = Joi.object({
  id: Joi.string().uuid().required().messages({
    "string.guid": "Note tag ID must be a valid UUID",
    "any.required": "Note tag ID is required",
  }),
});

const updateNoteTagSchema = Joi.object({
  name: Joi.string().trim().min(3).max(150).optional().messages({
    "string.base": "Name must be a string.",
    "string.max": "Name cannot exceed 100 characters.",
  }),

  background_color: Joi.string()
    .trim()
    .max(20)
    .pattern(/^#([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6})$/)
    .messages({
      "string.pattern.base":
        "Enter a valid background color in hex format (e.g., #FF5733).",
    })
    .optional(),

  font_color: Joi.string()
    .trim()
    .max(20)
    .pattern(/^#([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6})$/)
    .messages({
      "string.pattern.base":
        "Enter a valid font color in hex format (e.g., #FFFFFF).",
    })
    .optional(),

  is_active: Joi.boolean()
    .messages({
      "boolean.base": "is_active must be true or false.",
    })
    .optional(),
})
  .min(1)
  .messages({
    "object.min": "At least one field is required to update.",
  });

module.exports = {
  createNoteTageSchema,
  getAllNoteTagSchema,
  deleteNoteTagSchema,
  updateNoteTagIdParamsSchema,
  updateNoteTagSchema,
};
