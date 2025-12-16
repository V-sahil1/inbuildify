const Joi = require("joi");

const createSupplierSchema = Joi.object({
  company_name: Joi.string().max(255).required(),
  abn: Joi.string().max(50).allow(null, ""),
  description: Joi.string().allow(null, ""),
  contact_name: Joi.string().max(150).allow(null, ""),
  primary_phone: Joi.string()
    .pattern(/^[0-9+\-\s()]*$/)
    .max(50)
    .allow(null, "")
    .messages({
      "string.pattern.base":
        "Primary phone can only contain numbers, spaces, +, -, and parentheses",
      "string.max": "Primary phone cannot exceed 50 characters",
    }),
  secondary_phone: Joi.string()
    .pattern(/^[0-9+\-\s()]*$/)
    .max(50)
    .allow(null, "")
    .messages({
      "string.pattern.base":
        "Secondery phone can only contain numbers, spaces, +, -, and parentheses",
      "string.max": "Secondery phone cannot exceed 50 characters",
    }),
  website: Joi.string().uri().max(50).allow(null, ""),
  address_line1: Joi.string().max(255).allow(null, ""),
  city: Joi.string().max(150).allow(null, ""),
  state_id: Joi.string().uuid().allow(null, "").messages({
    "string.guid": "State ID must be a valid UUID",
  }),
  zip_code: Joi.string().max(20).allow(null, ""),
  lead_time: Joi.string().max(100).allow(null, ""),
  status: Joi.boolean().default(true),
  is_recommended: Joi.boolean().default(false),
  emails: Joi.array()
    .items(Joi.string().email({ tlds: { allow: false } }))
    .unique()
    .optional(),
});

const getAllSupplierSchema = Joi.object({
  company_name: Joi.string().trim().max(255).optional(),
  phone: Joi.string()
    .pattern(/^[0-9+\-\s()]*$/)
    .max(50)
    .optional()
    .allow(null, "")
    .messages({
      "string.pattern.base":
        "phone can only contain numbers, spaces, +, -, and parentheses",
      "string.max": "phone cannot exceed 50 characters",
    }),

  page: Joi.number().integer().min(1).default(1).messages({
    "number.base": "Page must be a number",
    "number.integer": "Page must be an integer",
    "number.min": "Page must be greater than 0",
  }),
  emails: Joi.array()
    .items(Joi.string().email({ tlds: { allow: false } }))
    .unique()
    .optional(),
  website: Joi.string().uri().allow(null, "").optional(),

  limit: Joi.number().integer().min(1).max(100).default(10).messages({
    "number.base": "Limit must be a number",
    "number.integer": "Limit must be an integer",
    "number.min": "Limit must be at least 1",
    "number.max": "Limit must not exceed 100",
  }),
});

const deleteSupplierSchema = Joi.object({
  supplier_id: Joi.string().uuid().required().messages({
    "string.guid": "Supplier ID must be a valid UUID",
    "any.required": "Supplier ID is required",
  }),
});

const updateSupplierParamsSchema = Joi.object({
  supplier_id: Joi.string().uuid().required().messages({
    "string.guid": "Supplier ID must be a valid UUID",
    "any.required": "Supplier ID is required",
  }),
});

const updateSupplierSchema = Joi.object({
  company_name: Joi.string().max(255).optional(),
  abn: Joi.string().max(50).allow(null, ""),
  description: Joi.string().allow(null, ""),
  contact_name: Joi.string().max(150).allow(null, ""),
  primary_phone: Joi.string()
    .pattern(/^[0-9+\-\s()]*$/)
    .max(50)
    .allow(null, "")
    .optional()
    .messages({
      "string.pattern.base":
        "Primary phone can only contain numbers, spaces, +, -, and parentheses",
      "string.max": "Primary phone cannot exceed 50 characters",
    }),
  secondary_phone: Joi.string()
    .pattern(/^[0-9+\-\s()]*$/)
    .max(50)
    .allow(null, "")
    .optional()
    .messages({
      "string.pattern.base":
        "Secondery phone can only contain numbers, spaces, +, -, and parentheses",
      "string.max": "Secondery phone cannot exceed 50 characters",
    }),
  website: Joi.string().uri().allow(null, "").optional(),
  address_line1: Joi.string().max(255).allow(null, "").optional(),
  city: Joi.string().max(150).allow(null, "").optional(),
  state_id: Joi.string().uuid().allow(null, "").optional().messages({
    "string.guid": "State ID must be a valid UUID",
  }),
  zip_code: Joi.string().max(20).allow(null, "").optional(),
  lead_time: Joi.string().max(100).allow(null, "").optional(),
  status: Joi.boolean(),
  is_recommended: Joi.boolean(),
  emails: Joi.array()
    .items(Joi.string().email({ tlds: { allow: false } }))
    .optional(),
});
module.exports = {
  createSupplierSchema,
  getAllSupplierSchema,
  deleteSupplierSchema,
  updateSupplierParamsSchema,
  updateSupplierSchema,
};
