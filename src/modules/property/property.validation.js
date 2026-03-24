import Joi from "joi";

export const createPropertyParamSchema = Joi.object({
  leads_id: Joi.string().uuid().required().messages({
    "string.guid": "Leads ID must be a valid UUID",
    "any.required": "Leads ID is required",
  }),
});

export const createPropertySchema = Joi.object({
  lot_number: Joi.string().allow("", null).max(255).optional(),
  street: Joi.string().allow("", null).max(255).optional(),
  address_line1: Joi.string().max(255).required().messages({
    "any.required": "Address Line 1 is required",
    "string.empty": "Address Line 1 cannot be empty",
  }),
  address_line2: Joi.string().allow("", null).max(255).optional(),
  city: Joi.string().max(255).required().messages({
    "any.required": "City is required",
    "string.empty": "City cannot be empty",
  }),
  state_id: Joi.string().uuid().required().messages({
    "string.guid": "State ID must be a valid UUID",
    "any.required": "State ID is required",
  }),
  country_id: Joi.string().uuid().required().messages({
    "string.guid": "Country ID must be a valid UUID",
    "any.required": "Country ID is required",
  }),
  zip_code: Joi.string().max(10).required().messages({
    "any.required": "Zip Code is required",
    "string.empty": "Zip Code cannot be empty",
  }),
  estate_name: Joi.string().allow("", null).max(255).optional(),
  title_status: Joi.string().valid("available",
    "sold",
    "reserved",
    "pending",
    "under_contract",
    "off_market",).allow("", null).optional(),
  title_date: Joi.date().allow(null).optional(),
  compaction_report: Joi.string()
    .valid("available",
      "not_available",).allow("", null)
    .optional(),
  land_type: Joi.string().valid("regular", "irregular").default("regular"),
  width_m: Joi.number().precision(2).allow(null).optional().min(0).max(99999999),
  depth_m: Joi.number().precision(2).allow(null).optional().min(0).max(99999999),
  total_size_m2: Joi.number().precision(2).allow(null).optional().min(0).max(99999999),
  site_fall_mm: Joi.number().precision(2).allow(null).optional().min(0).max(99999999),
  land_fill_mm: Joi.number().precision(2).allow(null).optional().min(0).max(99999999),
  bush_fire: Joi.boolean().default(false),
  corner_block: Joi.boolean().default(false),
});

export const updatePropertySchema = Joi.object({
  address: Joi.object({
    address_line1: Joi.string()
      .max(255)
      .messages({
        "string.empty": "Address line 1 cannot be empty",
      }),
    address_line2: Joi.string().allow("", null).max(255),
    city: Joi.string()
      .max(100)
      .messages({
        "string.empty": "City cannot be empty",
      }),
    state_id: Joi.string()
      .uuid()
      .messages({
        "string.guid": "State ID must be a valid UUID",
      }),
    country_id: Joi.string()
      .uuid()
      .messages({
        "string.guid": "Country ID must be a valid UUID",
      }),
    zip_code: Joi.string()
      .max(20)
      .messages({
        "string.empty": "Zip code cannot be empty",
      }),
  }).optional(),
  lot_no: Joi.number().integer().allow(null).optional(),
  street_no: Joi.number().integer().allow(null).optional(),
  estate_name: Joi.string().allow("", null).max(150),
  title_status: Joi.string().valid("ESTIMATED", "ACTUAL").optional(),
  title_date: Joi.date().optional(),
  compaction_report: Joi.string()
    .valid("available",
      "not_available",).allow("", null)
    .optional(),
  land_type: Joi.string().valid("regular", "irregular").optional(),
  width_m: Joi.number().precision(2).allow(null).optional().min(0).max(99999999),
  depth_m: Joi.number().precision(2).allow(null).optional().min(0).max(99999999),
  total_size_m2: Joi.number().precision(2).allow(null).optional().min(0).max(99999999),
  site_fall_mm: Joi.number().precision(2).allow(null).optional().min(0).max(99999999),
  land_fill_mm: Joi.number().precision(2).allow(null).optional().min(0).max(99999999),
  bush_fire: Joi.boolean().optional(),
  corner_block: Joi.boolean().optional(),
  price: Joi.number().precision(2).allow(null).optional().min(0).max(99999999),
});

export const getPropertyByLeadSchema = Joi.object({
  leads_id: Joi.string().uuid().required().messages({
    "string.guid": "Lead ID must be a valid UUID",
    "any.required": "Lead ID is required",
  }),
});

export const updatePropertyParamSchema = Joi.object({
  property_id: Joi.string().uuid().required().messages({
    "string.guid": "Property ID must be a valid UUID",
    "any.required": "Property ID is required",
  }),
});

export const getAllPropertiesSchema = Joi.object({
  search: Joi.string().allow("", null).optional(),
});

export const deletePropertySchema = Joi.object({
  property_id: Joi.string().uuid().required().messages({
    "string.guid": "Property ID must be a valid UUID",
    "any.required": "Property ID is required",
  }),
});

export default {
  createPropertySchema,
  getPropertyByLeadSchema,
  updatePropertySchema,
  updatePropertyParamSchema,
  getAllPropertiesSchema,
  deletePropertySchema,
};