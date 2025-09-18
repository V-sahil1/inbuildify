const Joi = require("joi");

const createPropertySchema = Joi.object({
  lead_id: Joi.string().uuid().required(),
  country: Joi.string().valid("australia").required(),
  address1: Joi.string().required().max(255),
  address2: Joi.string().allow("", null).max(255),
  city_suburb: Joi.string().required().max(100),
  state_region: Joi.string().required().max(100),
  zip_postal_code: Joi.string()
    .required()
    .pattern(/^\d{4}$/)
    .min(4)
    .max(4),
  estate_name: Joi.string().allow("", null).max(150),
  title_status: Joi.string().valid("ESTIMATED", "ACTUAL").required(),
  title_date: Joi.date().optional(),
  compaction_report: Joi.string()
    .valid("AVAILABLE", "NOT_AVAILABLE")
    .required(),
  land_type: Joi.string().valid("REGULAR", "IRREGULAR").required(),
  width_m: Joi.number().precision(2).optional().min(0).max(1000000),
  depth_m: Joi.number().precision(2).optional().min(0).max(1000000),
  total_size_m2: Joi.number().precision(2).optional().min(0).max(1000000),
  site_fall_mm: Joi.number().precision(2).optional().min(0).max(1000000),
  land_fill_mm: Joi.number().precision(2).optional().min(0).max(1000000),
  bush_fire: Joi.boolean().default(false),
  corner_block: Joi.boolean().default(false),
});

const getPropertyByLeadSchema = Joi.object({
  lead_id: Joi.string().uuid().required(),
});

module.exports = {
  createPropertySchema,
  getPropertyByLeadSchema,
};
