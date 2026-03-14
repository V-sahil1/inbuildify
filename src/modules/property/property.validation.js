const Joi = require("joi");

const createPropertySchema = Joi.object({
  leads_id: Joi.string().uuid().required().messages({
    "string.guid": "Leads ID must be a valid UUID",
    "any.required": "Leads ID is required",
  }),
  address: Joi.object({
    address_line1: Joi.string()
      .required()
      .max(255)
      .messages({
        "string.empty": "Address line 1 is required",
        "any.required": "Address line 1 is required",
      }),
    address_line2: Joi.string().allow("", null).max(255),
    city: Joi.string()
      .required()
      .max(100)
      .messages({
        "string.empty": "City is required",
        "any.required": "City is required",
      }),
    state_id: Joi.string()
      .uuid()
      .required()
      .messages({
        "string.guid": "State ID must be a valid UUID",
        "any.required": "State ID is required",
      }),
    country_id: Joi.string()
      .uuid()
      .required()
      .messages({
        "string.guid": "Country ID must be a valid UUID",
        "any.required": "Country ID is required",
      }),
    zip_code: Joi.string()
      .required()
      .max(20)
      .messages({
        "string.empty": "Zip code is required",
        "any.required": "Zip code is required",
      }),
  }).required(),
  lot_no: Joi.number().integer().allow(null).optional(),
  street_no: Joi.number().integer().allow(null).optional(),
  estate_name: Joi.string().allow("", null).max(150),
  title_status: Joi.string().valid("ESTIMATED", "ACTUAL").optional(),
  title_date: Joi.date().optional(),
  compaction_report: Joi.string()
    .valid("AVAILABLE", "NOT_AVAILABLE")
    .optional(),
  land_type: Joi.string().valid("REGULAR", "IRREGULAR").default("REGULAR"),
  width_m: Joi.number().precision(2).optional().min(0).max(1000000),
  depth_m: Joi.number().precision(2).optional().min(0).max(1000000),
  total_size_m2: Joi.number().precision(2).optional().min(0).max(1000000),
  site_fall_mm: Joi.number().precision(2).optional().min(0).max(1000000),
  land_fill_mm: Joi.number().precision(2).optional().min(0).max(1000000),
  bush_fire: Joi.boolean().default(false),
  corner_block: Joi.boolean().default(false),
});

const updatePropertySchema = Joi.object({
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
    .valid("AVAILABLE", "NOT_AVAILABLE")
    .optional(),
  land_type: Joi.string().valid("REGULAR", "IRREGULAR").optional(),
  width_m: Joi.number().precision(2).optional().min(0).max(1000000),
  depth_m: Joi.number().precision(2).optional().min(0).max(1000000),
  total_size_m2: Joi.number().precision(2).optional().min(0).max(1000000),
  site_fall_mm: Joi.number().precision(2).optional().min(0).max(1000000),
  land_fill_mm: Joi.number().precision(2).optional().min(0).max(1000000),
  bush_fire: Joi.boolean().optional(),
  corner_block: Joi.boolean().optional(),
});

const getPropertyByLeadSchema = Joi.object({
  leads_id: Joi.string().uuid().required().messages({
    "string.guid": "Lead ID must be a valid UUID",
    "any.required": "Lead ID is required",
  }),
});

const updatePropertyParamSchema = Joi.object({
  property_id: Joi.string().uuid().required().messages({
    "string.guid": "Property ID must be a valid UUID",
    "any.required": "Property ID is required",
  }),
});

const getAllPropertiesSchema = Joi.object({
  search: Joi.string().allow("", null).optional(),
});

const deletePropertySchema = Joi.object({
  property_id: Joi.string().uuid().required().messages({
    "string.guid": "Property ID must be a valid UUID",
    "any.required": "Property ID is required",
  }),
});

module.exports = {
  createPropertySchema,
  getPropertyByLeadSchema,
  updatePropertySchema,
  updatePropertyParamSchema,
  getAllPropertiesSchema,
  deletePropertySchema,
};
