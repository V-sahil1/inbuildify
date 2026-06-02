import Joi from "joi";

export const createSupplierSchema = Joi.object({
  supplier_type_id: Joi.array().items(Joi.string().uuid()).optional().messages({
    "array.sparse": "supplier_type_id cannot contain empty values",
    "array.unique": "supplier_type_id must be unique",
  }),
  company_name: Joi.string()
    .min(2)
    .max(150)
    .pattern(/^(?=.*[a-zA-Z])[a-zA-Z0-9\s,./#-]+$/)
    .optional(),
  abn: Joi.string().min(11).max(11).allow(null, ""),
  description: Joi.string().allow(null, ""),
  contact_name: Joi.string().min(2).max(150).allow(null, ""),
  primary_phone: Joi.string()
    .pattern(/^[0-9+\-\s()]*$/)
    .min(10)
    .max(14)
    .allow(null, "")
    .messages({
      "string.pattern.base":
        "Primary phone can only contain numbers, spaces, +, -, and parentheses",
      "string.max": "Primary phone cannot exceed 50 characters",
    }),
  secondary_phone: Joi.string()
    .pattern(/^[0-9+\-\s()]*$/)
    .min(10)
    .max(14)
    .allow(null, "")
    .messages({
      "string.pattern.base":
        "Secondery phone can only contain numbers, spaces, +, -, and parentheses",
      "string.max": "Secondery phone cannot exceed 50 characters",
    }),
  website: Joi.string().uri().max(255).allow(null, ""),
  address_line1: Joi.string()
    .min(10)
    .max(255)
    .pattern(/^(?=.*[a-zA-Z])[a-zA-Z0-9\s,./#-]+$/)
    .allow(null, ""),
  city: Joi.string()
    .min(2)
    .max(150)
    .pattern(/^(?=.*[a-zA-Z])[a-zA-Z0-9\s,./#-]+$/)
    .allow(null, ""),
  state_id: Joi.string().uuid().allow(null, "").messages({
    "string.guid": "State ID must be a valid UUID",
  }),
  zip_code: Joi.string().min(4).max(4).allow(null, "").optional(),
  lead_time: Joi.string().min(2).max(100).allow(null, "").optional(),
  status: Joi.boolean().default(true).optional(),
  emails: Joi.array()
    .items(Joi.string().email({ tlds: { allow: false } }))
    .unique()
    .optional(),
  // Supplier contacts - array of contact objects
  contacts: Joi.array()
    .items(
      Joi.object({
        contact_name: Joi.string().min(2).max(150).allow(null, ""),
        phone: Joi.string()
          .pattern(/^[0-9+\-\s()]*$/)
          .min(10)
          .max(14)
          .allow(null, "")
          .messages({
            "string.pattern.base":
              "Contact phone can only contain numbers, spaces, +, -, and parentheses",
            "string.max": "Contact phone cannot exceed 50 characters",
          }),
        email: Joi.string().email().allow(null, ""),
        contact_type: Joi.string().max(100).allow(null, ""),
      }),
    )
    .optional(),
  // Supplier document URLs - single image per field only
  work_cover_url: Joi.alternatives()
    .try(
      Joi.string().uri().allow(null, ""),
      Joi.object({
        location: Joi.string().uri().required(),
      }),
    )
    .allow(null, "")
    .optional(),
  pl_insurance_url: Joi.alternatives()
    .try(
      Joi.string().uri().allow(null, ""),
      Joi.object({
        location: Joi.string().uri().required(),
      }),
    )
    .allow(null, "")
    .optional(),
  white_card_url: Joi.alternatives()
    .try(
      Joi.string().uri().allow(null, ""),
      Joi.object({
        location: Joi.string().uri().required(),
      }),
    )
    .allow(null, "")
    .optional(),
  fork_lift_license_url: Joi.alternatives()
    .try(
      Joi.string().uri().allow(null, ""),
      Joi.object({
        location: Joi.string().uri().required(),
      }),
    )
    .allow(null, "")
    .optional(),
  trade_license_url: Joi.alternatives()
    .try(
      Joi.string().uri().allow(null, ""),
      Joi.object({
        location: Joi.string().uri().required(),
      }),
    )
    .allow(null, "")
    .optional(),
  induction_pack_received: Joi.boolean().default(false).optional(),
  induction_pack_url: Joi.alternatives()
    .try(
      Joi.string().uri().allow(null, ""),
      Joi.object({
        location: Joi.string().uri().required(),
      }),
    )
    .allow(null, "")
    .optional(),
});

export const getAllSupplierSchema = Joi.object({
  company_name: Joi.string().trim().max(255).optional(),
  phone: Joi.string()
    .pattern(/^[0-9+\-\s()]*$/)
    .max(14)
    .optional()
    .allow(null, "")
    .messages({
      "string.pattern.base":
        "phone can only contain numbers, spaces, +, -, and parentheses",
      "string.max": "phone cannot exceed 50 characters",
    }),

  emails: Joi.string().max(255).allow(null, "").optional(),
  website: Joi.string().max(255).allow(null, "").optional(),

  status: Joi.boolean().optional(),
  supplier_type_id: Joi.string().uuid().optional().messages({
    "string.guid": "Supplier Type ID must be a valid UUID",
  }),
  induction: Joi.boolean().optional(),
});

export const deleteSupplierSchema = Joi.object({
  supplier_id: Joi.string().uuid().required().messages({
    "string.guid": "Supplier ID must be a valid UUID",
    "any.required": "Supplier ID is required",
  }),
});

export const getSupplierByIdSchema = Joi.object({
  supplier_id: Joi.string().uuid().required().messages({
    "string.guid": "Supplier ID must be a valid UUID",
    "any.required": "Supplier ID is required",
  }),
});

export const updateSupplierParamsSchema = Joi.object({
  supplier_id: Joi.string().uuid().required().messages({
    "string.guid": "Supplier ID must be a valid UUID",
    "any.required": "Supplier ID is required",
  }),
});

export const updateSupplierSchema = Joi.object({
  supplier_type_id: Joi.array().items(Joi.string().uuid()).optional().messages({
    "array.sparse": "supplier_type_id cannot contain empty values",
    "array.unique": "supplier_type_id must be unique",
  }),
  company_name: Joi.string()
    .min(2)
    .max(255)
    .pattern(/^(?=.*[a-zA-Z])[a-zA-Z0-9\s,./#-]+$/)
    .optional(),
  abn: Joi.string().min(11).max(11).allow(null, ""),
  description: Joi.string().allow(null, ""),
  contact_name: Joi.string().max(150).allow(null, ""),
  primary_phone: Joi.string()
    .pattern(/^[0-9+\-\s()]*$/)
    .min(10)
    .max(14)
    .allow(null, "")
    .optional()
    .messages({
      "string.pattern.base":
        "Primary phone can only contain numbers, spaces, +, -, and parentheses",
      "string.max": "Primary phone cannot exceed 50 characters",
    }),
  secondary_phone: Joi.string()
    .pattern(/^[0-9+\-\s()]*$/)
    .min(10)
    .max(14)
    .allow(null, "")
    .optional()
    .messages({
      "string.pattern.base":
        "Secondery phone can only contain numbers, spaces, +, -, and parentheses",
      "string.max": "Secondery phone cannot exceed 50 characters",
    }),
  website: Joi.string().uri().max(255).allow(null, "").optional(),
  address_line1: Joi.string().max(255).allow(null, "").optional(),
  city: Joi.string().max(150).allow(null, "").optional(),
  state_id: Joi.string().uuid().allow(null, "").optional().messages({
    "string.guid": "State ID must be a valid UUID",
  }),
  zip_code: Joi.string().min(4).max(4).allow(null, "").optional(),
  lead_time: Joi.string().max(100).allow(null, "").optional(),
  status: Joi.boolean(),
  emails: Joi.array()
    .items(Joi.string().email({ tlds: { allow: false } }))
    .optional(),
  // Supplier contacts - array of contact objects
  contacts: Joi.array()
    .items(
      Joi.object({
        contact_name: Joi.string().min(2).max(150).allow(null, ""),
        phone: Joi.string()
          .pattern(/^[0-9+\-\s()]*$/)
          .min(10)
          .max(14)
          .allow(null, "")
          .messages({
            "string.pattern.base":
              "Contact phone can only contain numbers, spaces, +, -, and parentheses",
            "string.max": "Contact phone cannot exceed 50 characters",
          }),
        email: Joi.string().email().allow(null, ""),
        contact_type: Joi.string().max(100).allow(null, ""),
      }),
    )
    .optional(),
  // Supplier document URLs - single image per field only
  work_cover_url: Joi.alternatives()
    .try(
      Joi.string().uri().allow(null, ""),
      Joi.object({
        location: Joi.string().uri().required(),
      }),
    )
    .allow(null, "")
    .optional(),
  pl_insurance_url: Joi.alternatives()
    .try(
      Joi.string().uri().allow(null, ""),
      Joi.object({
        location: Joi.string().uri().required(),
      }),
    )
    .allow(null, "")
    .optional(),
  white_card_url: Joi.alternatives()
    .try(
      Joi.string().uri().allow(null, ""),
      Joi.object({
        location: Joi.string().uri().required(),
      }),
    )
    .allow(null, "")
    .optional(),
  fork_lift_license_url: Joi.alternatives()
    .try(
      Joi.string().uri().allow(null, ""),
      Joi.object({
        location: Joi.string().uri().required(),
      }),
    )
    .allow(null, "")
    .optional(),
  trade_license_url: Joi.alternatives()
    .try(
      Joi.string().uri().allow(null, ""),
      Joi.object({
        location: Joi.string().uri().required(),
      }),
    )
    .allow(null, "")
    .optional(),
  induction_pack_received: Joi.boolean().optional(),
  induction_pack_url: Joi.alternatives()
    .try(
      Joi.string().uri().allow(null, ""),
      Joi.object({
        location: Joi.string().uri().required(),
      }),
    )
    .allow(null, "")
    .optional(),
});

export default {
  createSupplierSchema,
  getAllSupplierSchema,
  deleteSupplierSchema,
  getSupplierByIdSchema,
  updateSupplierParamsSchema,
  updateSupplierSchema,
};
