const Joi = require("joi");

const createLeadSchema = Joi.object({
  force_create: Joi.boolean().optional().default(false),
  name: Joi.string().min(2).max(255).required().messages({
    "string.min": "Name must be at least 2 characters long",
    "string.max": "Name must not exceed 255 characters",
    "any.required": "Name is required",
  }),
  email: Joi.string().email().max(255).required().messages({
    "string.email": "Please provide a valid email address",
    "string.max": "Email must not exceed 255 characters",
    "any.required": "Email is required",
  }),
  phone: Joi.string().max(20).optional().allow(null, "").messages({
    "string.max": "Phone must not exceed 20 characters",
  }),
  notes: Joi.string().max(1000).optional().allow(null, "").messages({
    "string.max": "Notes must not exceed 1000 characters",
  }),
  send_letter: Joi.boolean().optional().default(false),
  lead_source_id: Joi.string().uuid().optional().allow(null).messages({
    "string.guid": "Lead source ID must be a valid UUID",
  }),
}).messages({
  "object.unknown": "Only specified fields are allowed during lead creation",
});

const getLeadByIdSchema = Joi.object({
  leads_id: Joi.string().uuid().required().messages({
    "string.guid": "Lead ID must be a valid UUID",
    "any.required": "Lead ID is required",
  }),
});

const updateLeadSchema = Joi.object({
  reference_number: Joi.string().max(30).optional(),

  name: Joi.string().min(2).max(255).optional().messages({
    "string.min": "Name must be at least 2 characters long",
    "string.max": "Name must not exceed 255 characters",
  }),
  email: Joi.string().email().max(255).optional().messages({
    "string.email": "Please provide a valid email address",
    "string.max": "Email must not exceed 255 characters",
  }),
  phone: Joi.string().max(20).optional().allow(null, "").messages({
    "string.max": "Phone must not exceed 20 characters",
  }),
  notes: Joi.string().max(1000).optional().allow(null, "").messages({
    "string.max": "Notes must not exceed 1000 characters",
  }),
  send_letter: Joi.boolean().optional(),
  lead_source_id: Joi.string().uuid().optional().allow(null).messages({
    "string.guid": "Lead source ID must be a valid UUID",
  }),
  contact_id: Joi.string().uuid().optional().allow(null).messages({
    "string.guid": "Contact ID must be a valid UUID",
  }),
  house_land_package_id: Joi.string().uuid().optional().allow(null).messages({
    "string.guid": "House Land Package ID must be a valid UUID",
  }),
  opportunity_notes: Joi.string().max(1000).optional().allow(null, "").messages({
    "string.max": "Opportunity notes must not exceed 1000 characters",
  }),
  status: Joi.string()
    .valid("New", "Working", "Convert")
    .optional()
    .messages({
      "any.only": "Status must be one of: New, Working, Convert",
    }),
  outcome: Joi.string().valid("Won", "Lost").optional().allow(null).messages({
    "any.only": "Outcome must be either Won or Lost",
  }),
  rating: Joi.string()
    .valid("Hot", "Warm", "Cold", "None")
    .optional()
    .allow(null)
    .messages({
      "any.only": "Rating must be one of: Hot, Warm, Cold, None",
    }),
  land: Joi.string()
    .valid("None", "No", "Yes")
    .optional()
    .allow(null)
    .messages({
      "any.only": "Land must be one of: None, No, Yes",
    }),
  finance: Joi.string()
    .valid("None", "No", "Yes")
    .optional()
    .allow(null)
    .messages({
      "any.only": "Finance must be one of: None, No, Yes",
    }),
  face_to_face: Joi.string()
    .valid("None", "Yes", "No")
    .optional()
    .allow(null)
    .messages({
      "any.only": "Face to face must be one of: None, Yes, No",
    }),
  purpose: Joi.string()
    .valid("None", "Own House", "Investment Property")
    .optional()
    .allow(null)
    .messages({
      "any.only":
        "Purpose must be one of: None, Own House, Investment Property",
    }),
  client_type_id: Joi.string().uuid().optional().allow(null).messages({
    "string.guid": "Client type ID must be a valid UUID",
  }),
  forcast_close: Joi.date().optional().allow(null).messages({
    "date.base": "Forecast close date must be a valid date",
  }),
  build_budget: Joi.number().precision(2).optional().allow(null).messages({
    "number.base": "Build budget must be a number",
    "number.precision": "Build budget can have maximum 2 decimal places",
  }),
  region_id: Joi.string().uuid().optional().allow(null).messages({
    "string.guid": "Region ID must be a valid UUID",
  }),
  prelim_agreement: Joi.date().optional().allow(null).messages({
    "date.base": "Preliminary agreement date must be a valid date",
  }),
  client_profile: Joi.string().max(500).optional().allow(null, "").messages({
    "string.max": "Client profile must not exceed 500 characters",
  }),
  h_l_budget: Joi.number().precision(2).optional().allow(null).messages({
    "number.base": "H&L budget must be a number",
    "number.precision": "H&L budget can have maximum 2 decimal places",
  }),
  assignee_id: Joi.string().uuid().optional().allow(null).messages({
    "string.guid": "Assignee ID must be a valid UUID",
  }),
})
  .min(1)
  .messages({
    "object.min": "At least one field must be provided for update",
  });

const updateLeadStatusSchema = Joi.object({
  status: Joi.string()
    .valid("New", "Working", "Qualified", "Closed")
    .required()
    .messages({
      "any.only": "Status must be one of: New, Working, Qualified, Closed",
      "any.required": "Status is required",
    }),
});

const assignLeadSchema = Joi.object({
  assignee_id: Joi.string().uuid().required().messages({
    "string.guid": "Assignee ID must be a valid UUID",
    "any.required": "Assignee ID is required",
  }),
});

const getAllLeadsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1).messages({
    "number.base": "Page must be a number",
    "number.integer": "Page must be an integer",
    "number.min": "Page must be at least 1",
  }),
  limit: Joi.number().integer().min(1).max(100).default(25).messages({
    "number.base": "Limit must be a number",
    "number.integer": "Limit must be an integer",
    "number.min": "Limit must be at least 1",
    "number.max": "Limit must not exceed 100",
  }),
  status: Joi.string()
    .valid("New", "Working", "Qualified", "Closed")
    .optional(),
  outcome: Joi.string().valid("Won", "Lost").optional(),
  rating: Joi.string().valid("Hot", "Warm", "Cold", "None").optional(),
  lead_source_id: Joi.string().uuid().optional(),
  client_type_id: Joi.string().uuid().optional(),
  region_id: Joi.string().uuid().optional(),
  assignee_id: Joi.string().uuid().optional(),
  search: Joi.string().max(100).optional().messages({
    "string.max": "Search term must not exceed 100 characters",
  }),
});

module.exports = {
  createLeadSchema,
  getLeadByIdSchema,
  updateLeadSchema,
  updateLeadStatusSchema,
  assignLeadSchema,
  getAllLeadsQuerySchema,
};
