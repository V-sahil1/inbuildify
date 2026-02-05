const Joi = require("joi");

const getAllColorItemsSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1).messages({
    "number.base": "Page must be a number",
    "number.integer": "Page must be an integer",
    "number.min": "Page must be greater than 0",
  }),

  limit: Joi.number().integer().min(1).max(100).default(25).messages({
    "number.base": "Limit must be a number",
    "number.integer": "Limit must be an integer",
    "number.min": "Limit must be at least 1",
    "number.max": "Limit must not exceed 100",
  }),

  status: Joi.boolean().optional().messages({
    "any.only": "Status must be either 'true' or 'false'",
  }),

  search: Joi.string().trim().max(255).allow("").optional().messages({
    "string.max": "Search term must not exceed 255 characters",
  }),

  costType: Joi.string()
    .max(50)
    .valid("standard", "upgrade")
    .optional()
    .messages({
      "any.only": "Cost type must be either 'standard' or 'upgrade'",
    }),

  upgradeOption: Joi.string()
    .max(50)
    .valid("fixed", "start_from", "tba")
    .optional()
    .messages({
      "any.only": "Upgrade option must be one of: fixed, start_from, tba",
    }),

  units: Joi.string()
    .max(50)
    .valid("mandatory", "non_mandatory", "not_required")
    .optional()
    .messages({
      "any.only":
        "Units must be one of: mandatory, non_mandatory, not_required",
    }),
});

const getColorItemByIdSchema = Joi.object({
  color_item_id: Joi.string().uuid().required().messages({
    "any.required": "Color item ID is required",
    "string.uuid": "Color item ID must be a valid UUID",
    "string.guid": "Color item ID must be a valid UUID",
  }),
});

const createColorItemSchema = Joi.object({
  default_image_index: Joi.number().integer().optional(),
  item_name: Joi.string()
    .trim()
    .min(2)
    .max(255)
    .pattern(/^(?=.*[a-zA-Z])[a-zA-Z0-9\s,./#-]+$/)
    .required()
    .messages({
      "any.required": "Item name is required",
      "string.empty": "Item name cannot be empty",
      "string.max": "Item name must not exceed 255 characters",
    }),

  color_category_id: Joi.string().uuid().optional().allow(null).messages({
    "string.uuid": "color category ID must be a valid UUID",
    "string.guid": "color category ID must be a valid UUID",
  }),

  item_code: Joi.string().trim().min(5).max(10).required().messages({
    "any.required": "Item code is required",
    "string.empty": "Item code cannot be empty",
    "string.max": "Item code must not exceed 100 characters",
  }),

  supplier_id: Joi.string().uuid().optional().allow(null).messages({
    "string.uuid": "Supplier ID must be a valid UUID",
    "string.guid": "Supplier ID must be a valid UUID",
  }),

  upgrade_option: Joi.string()
    .max(50)
    .valid("fixed", "start_from", "tba")
    .optional()
    .allow(null)
    .messages({
      "any.only": "Upgrade option must be one of: fixed, start_from, tba",
    }),

  cost_type: Joi.string()
    .max(50)
    .valid("standard", "upgrade")
    .default("standard")
    .messages({
      "any.only": "Cost type must be either 'standard' or 'upgrade'",
    }),

  cost: Joi.number().positive().precision(2).optional().allow(null).messages({
    "number.base": "Cost must be a number",
    "number.positive": "Cost must be positive",
    "number.precision": "Cost can have maximum 2 decimal places",
  }),

  features: Joi.string()
    .trim()
    .max(500)
    .allow("")
    .pattern(/^[^<>]*$/)
    .optional()
    .messages({
      "string.max": "Features must not exceed 500 characters",
    }),

  description: Joi.string()
    .trim()
    .max(500)
    .allow("")
    .pattern(/^[^<>]*$/)
    .optional()
    .messages({
      "string.max": "Description must not exceed 500 characters",
    }),

  specification_name: Joi.string()
    .trim()
    .max(500)
    .allow("")
    .pattern(/^[^<>]*$/)
    .optional()
    .messages({
      "string.max": "specification name must not exceed 500 characters",
    }),

  units: Joi.string()
    .max(50)
    .valid("mandatory", "non_mandatory", "not_required")
    .default("non_mandatory")
    .messages({
      "any.only":
        "Units must be one of: mandatory, non_mandatory, not_required",
    }),

  color_image: Joi.string().uri().optional().allow(null).messages({
    "string.uri": "Color image must be a valid URL",
  }),

  specification: Joi.string().trim().max(500).allow("").optional().messages({
    "string.max": "Specification must not exceed 500 characters",
  }),

  status: Joi.boolean().default(true).messages({
    "boolean.base": "Status must be true or false",
  }),
});

const updateColorItemSchema = Joi.object({
  default_image_index: Joi.number().integer().optional(),

  item_name: Joi.string()
    .trim()
    .min(2)
    .max(255)
    .pattern(/^(?=.*[a-zA-Z])[a-zA-Z0-9\s,./#-]+$/)
    .optional()
    .messages({
      "string.empty": "Item name cannot be empty",
      "string.max": "Item name must not exceed 255 characters",
    }),

  item_code: Joi.string().trim().min(5).max(10).optional().messages({
    "string.empty": "Item code cannot be empty",
    "string.max": "Item code must not exceed 100 characters",
  }),

  supplier_id: Joi.string().uuid().optional().allow(null).messages({
    "string.uuid": "Supplier ID must be a valid UUID",
    "string.guid": "Supplier ID must be a valid UUID",
  }),

  upgrade_option: Joi.string()
    .max(50)
    .valid("fixed", "start_from", "tba")
    .optional()
    .allow(null)
    .messages({
      "any.only": "Upgrade option must be one of: fixed, start_from, tba",
    }),

  cost_type: Joi.string()
    .max(50)
    .valid("standard", "upgrade")
    .optional()
    .messages({
      "any.only": "Cost type must be either 'standard' or 'upgrade'",
    }),

  cost: Joi.number().positive().precision(2).optional().allow(null).messages({
    "number.base": "Cost must be a number",
    "number.positive": "Cost must be positive",
    "number.precision": "Cost can have maximum 2 decimal places",
  }),

  features: Joi.string()
    .trim()
    .max(500)
    .allow("")
    .pattern(/^[^<>]*$/)
    .optional()
    .messages({
      "string.max": "Features must not exceed 500 characters",
    }),

  description: Joi.string()
    .trim()
    .max(500)
    .allow("")
    .pattern(/^[^<>]*$/)
    .optional()
    .messages({
      "string.max": "Description must not exceed 500 characters",
    }),

  specification_name: Joi.string()
    .trim()
    .max(500)
    .allow("")
    .pattern(/^[^<>]*$/)
    .optional()
    .messages({
      "string.max": "specification name must not exceed 500 characters",
    }),

  units: Joi.string()
    .max(50)
    .valid("mandatory", "non_mandatory", "not_required")
    .optional()
    .messages({
      "any.only":
        "Units must be one of: mandatory, non_mandatory, not_required",
    }),

  color_image: Joi.string().trim().max(500).allow("").optional().messages({
    "string.max": "Color image must not exceed 500 characters",
  }),

  specification: Joi.string().trim().max(500).allow("").optional().messages({
    "string.max": "Specification must not exceed 500 characters",
  }),

  status: Joi.boolean().optional().messages({
    "boolean.base": "Status must be true or false",
  }),
})
  .min(1)
  .message({ "object.min": "At least one field is required to update" });

const deleteColorItemSchema = Joi.object({
  color_item_id: Joi.string().uuid().required().messages({
    "any.required": "Color item ID is required",
    "string.uuid": "Color item ID must be a valid UUID",
    "string.guid": "Color item ID must be a valid UUID",
  }),
});

const deleteImageFieldSchema = Joi.object({
  field_name: Joi.string()
    .max(255)
    .valid("color_image", "specification")
    .required()
    .messages({
      "any.required": "Field name is required",
      "any.only": "Field name must be either 'color_image' or 'specification'",
    }),

  index: Joi.number().integer().optional(),
});

const colorItemMoveSchema = Joi.object({
  color_id: Joi.string().uuid().required().messages({
    "any.required": "Color ID is required",
    "string.uuid": "Color ID must be a valid UUID",
    "string.guid": "Color ID must be a valid UUID",
  }),

  color_category_id: Joi.string().uuid().required().messages({
    "any.required": "Color category ID is required",
    "string.uuid": "Color category ID must be a valid UUID",
    "string.guid": "Color categroy ID must be a valid UUID",
  }),
});
module.exports = {
  getAllColorItemsSchema,
  getColorItemByIdSchema,
  createColorItemSchema,
  updateColorItemSchema,
  deleteColorItemSchema,
  deleteImageFieldSchema,
  colorItemMoveSchema,
};
