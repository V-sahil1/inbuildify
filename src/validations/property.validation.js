const Joi = require("joi");

const createPropertyParamSchema = Joi.object({
  leads_id: Joi.string().uuid().required().messages({
    "string.guid": "Leads ID must be a valid UUID",
    "any.required": "Leads ID is required",
  }),
});

const compactionReportContentSchema = Joi.object({
  landType: Joi.string().valid("Rocky", "Sloping", "Plain", "Uneven", "Filled Land").optional(),
  groundLevel: Joi.string().valid("Above Road Level", "At Road Level", "Below Road Level").optional(),
  slopeCondition: Joi.string().valid("Flat", "Gentle Slope", "Steep Slope").optional(),
  soilType: Joi.string().valid("Clay", "Sand", "Silt", "Gravel", "Mixed").optional(),
  soilClass: Joi.string().valid("A", "S", "M", "H1", "H2", "E", "P").optional(),
  moistureContent: Joi.number().optional(),
  dryDensity: Joi.number().optional(),
  maxDryDensity: Joi.number().optional(),
  compaction: Joi.number().optional(),
  result: Joi.string().valid("pass", "fail").optional(),
  engineerName: Joi.string().allow("", null).optional(),
  remarks: Joi.string().allow("", null).optional(),
});

const createPropertySchema = Joi.object({
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
    "off_market").allow("", null).optional(),
  title_date: Joi.date().allow(null).optional(),
  compaction_report: Joi.string()
    .valid("available",
      "not_available").allow("", null)
    .optional(),
  compaction_report_url: Joi.string().allow("", null).max(500).when("compaction_report", {
    is: "available",
    then: Joi.optional(),
    otherwise: Joi.forbidden(),
  }),
  compaction_report_content: compactionReportContentSchema.allow(null).when("compaction_report", {
    is: "available",
    then: Joi.optional(),
    otherwise: Joi.forbidden(),
  }),
  land_type: Joi.string().valid("regular", "irregular").default("regular"),
  width_m: Joi.number().precision(2).allow(null).optional().min(0).max(99999999),
  depth_m: Joi.number().precision(2).allow(null).optional().min(0).max(99999999),
  total_size_m2: Joi.number().precision(2).allow(null).optional().min(0).max(99999999),
  site_fall_mm: Joi.number().precision(2).allow(null).optional().min(0).max(99999999),
  land_fill_mm: Joi.number().precision(2).allow(null).optional().min(0).max(99999999),
  bush_fire: Joi.boolean().default(false),
  corner_block: Joi.boolean().default(false),
});

const updatePropertySchema = Joi.object({
  lot_number: Joi.string().allow("", null).max(255).optional(),
  street: Joi.string().allow("", null).max(255).optional(),
  address_line1: Joi.string().allow("", null).max(255).optional(),
  address_line2: Joi.string().allow("", null).max(255).optional(),
  city: Joi.string().allow("", null).max(255).optional(),
  state_id: Joi.string().uuid().allow(null).optional().messages({
    "string.guid": "State ID must be a valid UUID",
  }),
  country_id: Joi.string().uuid().allow(null).optional().messages({
    "string.guid": "Country ID must be a valid UUID",
  }),
  zip_code: Joi.string().allow("", null).max(10).optional(),
  estate_id: Joi.string().uuid().allow(null).optional().messages({
    "string.guid": "Estate ID must be a valid UUID",
  }),
  estate_stage_id: Joi.string().uuid().allow(null).optional().messages({
    "string.guid": "Estate Stage ID must be a valid UUID",
  }),
  estate_name: Joi.string().allow("", null).max(255).optional(),
  title_status: Joi.string().valid("available",
    "sold",
    "reserved",
    "pending",
    "under_contract",
    "off_market").allow("", null).optional(),
  title_date: Joi.date().allow(null).optional(),
  compaction_report: Joi.string()
    .valid("available",
      "not_available").allow("", null)
    .optional(),
  compaction_report_url: Joi.string().allow("", null).max(500).when("compaction_report", {
    is: "available",
    then: Joi.optional(),
    otherwise: Joi.forbidden(),
  }),
  compaction_report_content: compactionReportContentSchema.allow(null).when("compaction_report", {
    is: "available",
    then: Joi.optional(),
    otherwise: Joi.forbidden(),
  }),
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

const getPropertyByLeadSchema = Joi.object({
  leads_id: Joi.string().uuid().required().messages({
    "string.guid": "Lead ID must be a valid UUID",
    "any.required": "Lead ID is required",
  }),
});

const updatePropertyParamSchema = Joi.object({
  property_detail_id: Joi.string().uuid().required().messages({
    "string.guid": "Property Detail ID must be a valid UUID",
    "any.required": "Property Detail ID is required",
  }),
});

const getAllPropertiesSchema = Joi.object({
  search: Joi.string().allow("", null).optional(),
});

const deletePropertySchema = Joi.object({
  property_detail_id: Joi.string().uuid().required().messages({
    "string.guid": "Property Detail ID must be a valid UUID",
    "any.required": "Property Detail ID is required",
  }),
});

module.exports = {
  createPropertyParamSchema,
  createPropertySchema,
  getPropertyByLeadSchema,
  updatePropertySchema,
  updatePropertyParamSchema,
  getAllPropertiesSchema,
  deletePropertySchema,
};
