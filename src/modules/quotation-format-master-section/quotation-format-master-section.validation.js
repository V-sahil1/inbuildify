const Joi = require("joi");

// ============================================================
//        MASTER SECTION VALIDATION SCHEMAS
// ============================================================

const createMasterSectionSchema = Joi.object({
  master_name: Joi.string().min(2).max(255).required().messages({
    "string.empty": "Master name is required.",
    "string.min": "Master name must be at least 2 characters.",
    "string.max": "Master name must not exceed 255 characters.",
    "any.required": "Master name is required.",
  }),
  status: Joi.boolean().optional().default(true).messages({
    "boolean.base": "Status must be a boolean value.",
  }),
});

const updateMasterSectionSchema = Joi.object({
  master_name: Joi.string().min(2).max(255).optional().messages({
    "string.empty": "Master name cannot be empty.",
    "string.min": "Master name must be at least 2 characters.",
    "string.max": "Master name must not exceed 255 characters.",
  }),
  status: Joi.boolean().optional().messages({
    "boolean.base": "Status must be a boolean value.",
  }),
})
  .min(1)
  .messages({
    "object.min": "At least one field must be provided for update.",
  });

const getMasterSectionSchema = Joi.object({
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
  search: Joi.string().max(255).optional().messages({
    "string.max": "Search term must not exceed 255 characters.",
  }),
  status: Joi.boolean().optional().messages({
    "boolean.base": "Status must be a boolean value.",
  }),
});

const paramsMasterSectionIdSchema = Joi.object({
  master_section_id: Joi.string().uuid().required().messages({
    "string.guid": "Master section ID must be a valid UUID",
    "any.required": "Master section ID is required",
  }),
});

// ============================================================
//        MASTER SECTION HEADER VALIDATION SCHEMAS
// ============================================================

const createMasterSectionHeaderSchema = Joi.object({
  master_section: Joi.string().uuid().required().messages({
    "string.guid": "Master section must be a valid UUID",
    "any.required": "Master section is required",
  }),
  heading_name: Joi.string().min(2).max(255).required().messages({
    "string.empty": "Heading name is required.",
    "string.min": "Heading name must be at least 2 characters.",
    "string.max": "Heading name must not exceed 255 characters.",
    "any.required": "Heading name is required.",
  }),
  effective_start_date: Joi.date().allow(null).optional().messages({
    "date.base": "Effective start date must be a valid date",
  }),
  effective_end_date: Joi.date().allow(null).optional().messages({
    "date.base": "Effective end date must be a valid date",
  }),
  sort_order: Joi.number().integer().min(1).optional().messages({
    "number.base": "Sort order must be a number",
    "number.integer": "Sort order must be an integer",
    "number.min": "Sort order must be at least 1",
  }),
  status: Joi.boolean().optional().default(true).messages({
    "boolean.base": "Status must be a boolean value.",
  }),
})
  .custom((value, helpers) => {
    if (value.effective_start_date && value.effective_end_date) {
      const startDate = new Date(value.effective_start_date);
      const endDate = new Date(value.effective_end_date);
      if (startDate > endDate) {
        return helpers.error("custom.dateRange");
      }
    }
    return value;
  })
  .messages({
    "custom.dateRange":
      "Effective start date cannot be after effective end date",
  });

const updateMasterSectionHeaderSchema = Joi.object({
  heading_name: Joi.string().min(2).max(255).optional().messages({
    "string.empty": "Heading name cannot be empty.",
    "string.min": "Heading name must be at least 2 characters.",
    "string.max": "Heading name must not exceed 255 characters.",
  }),
  effective_start_date: Joi.date().allow(null).optional().messages({
    "date.base": "Effective start date must be a valid date",
  }),
  effective_end_date: Joi.date().allow(null).optional().messages({
    "date.base": "Effective end date must be a valid date",
  }),
  sort_order: Joi.number().integer().min(1).optional().messages({
    "number.base": "Sort order must be a number",
    "number.integer": "Sort order must be an integer",
    "number.min": "Sort order must be at least 1",
  }),
  status: Joi.boolean().optional().messages({
    "boolean.base": "Status must be a boolean value.",
  }),
})
  .min(1)
  .messages({
    "object.min": "At least one field must be provided for update.",
  })
  .custom((value, helpers) => {
    if (value.effective_start_date && value.effective_end_date) {
      const startDate = new Date(value.effective_start_date);
      const endDate = new Date(value.effective_end_date);
      if (startDate > endDate) {
        return helpers.error("custom.dateRange");
      }
    }
    return value;
  })
  .messages({
    "custom.dateRange":
      "Effective start date cannot be after effective end date",
  });

const getMasterSectionHeaderSchema = Joi.object({
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
  search: Joi.string().max(255).optional().messages({
    "string.max": "Search term must not exceed 255 characters.",
  }),
  status: Joi.boolean().optional().messages({
    "boolean.base": "Status must be a boolean value.",
  }),
  master_section: Joi.string().uuid().optional().messages({
    "string.guid": "Master section must be a valid UUID",
  }),
});

const paramsHeaderIdSchema = Joi.object({
  header_id: Joi.string().uuid().required().messages({
    "string.guid": "Header ID must be a valid UUID",
    "any.required": "Header ID is required",
  }),
});

// ============================================================
//        MASTER SECTION ITEM VALIDATION SCHEMAS
// ============================================================

const createMasterSectionItemSchema = Joi.object({
  master_section_header_id: Joi.string().uuid().required().messages({
    "string.guid": "Master section header must be a valid UUID",
    "any.required": "Master section header is required",
  }),
  item_name: Joi.string().min(2).max(2000).required().messages({
    "string.empty": "Item name is required.",
    "string.min": "Item name must be at least 2 characters.",
    "string.max": "Item name must not exceed 2000 characters.",
    "any.required": "Item name is required.",
  }),
  effective_start_date: Joi.date().allow(null).optional().messages({
    "date.base": "Effective start date must be a valid date",
  }),
  effective_end_date: Joi.date().allow(null).optional().messages({
    "date.base": "Effective end date must be a valid date",
  }),
  sort_order: Joi.number().integer().min(1).optional().messages({
    "number.base": "Sort order must be a number",
    "number.integer": "Sort order must be an integer",
    "number.min": "Sort order must be at least 1",
  }),
  status: Joi.boolean().optional().default(true).messages({
    "boolean.base": "Status must be a boolean value.",
  }),
})
  .custom((value, helpers) => {
    if (value.effective_start_date && value.effective_end_date) {
      const startDate = new Date(value.effective_start_date);
      const endDate = new Date(value.effective_end_date);
      if (startDate > endDate) {
        return helpers.error("custom.dateRange");
      }
    }
    return value;
  })
  .messages({
    "custom.dateRange":
      "Effective start date cannot be after effective end date",
  });

const updateMasterSectionItemSchema = Joi.object({
  item_name: Joi.string().min(2).max(2000).optional().messages({
    "string.empty": "Item name cannot be empty.",
    "string.min": "Item name must be at least 2 characters.",
    "string.max": "Item name must not exceed 2000 characters.",
  }),
  effective_start_date: Joi.date().allow(null).optional().messages({
    "date.base": "Effective start date must be a valid date",
  }),
  effective_end_date: Joi.date().allow(null).optional().messages({
    "date.base": "Effective end date must be a valid date",
  }),
  sort_order: Joi.number().integer().min(1).optional().messages({
    "number.base": "Sort order must be a number",
    "number.integer": "Sort order must be an integer",
    "number.min": "Sort order must be at least 1",
  }),
  status: Joi.boolean().optional().messages({
    "boolean.base": "Status must be a boolean value.",
  }),
})
  .min(1)
  .messages({
    "object.min": "At least one field must be provided for update.",
  })
  .custom((value, helpers) => {
    if (value.effective_start_date && value.effective_end_date) {
      const startDate = new Date(value.effective_start_date);
      const endDate = new Date(value.effective_end_date);
      if (startDate > endDate) {
        return helpers.error("custom.dateRange");
      }
    }
    return value;
  })
  .messages({
    "custom.dateRange":
      "Effective start date cannot be after effective end date",
  });

const getMasterSectionItemSchema = Joi.object({
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
  search: Joi.string().max(255).optional().messages({
    "string.max": "Search term must not exceed 255 characters.",
  }),
  status: Joi.boolean().optional().messages({
    "boolean.base": "Status must be a boolean value.",
  }),
  master_section_header_id: Joi.string().uuid().optional().messages({
    "string.guid": "Master section header must be a valid UUID",
  }),
});

const paramsItemIdSchema = Joi.object({
  item_id: Joi.string().uuid().required().messages({
    "string.guid": "Item ID must be a valid UUID",
    "any.required": "Item ID is required",
  }),
});

module.exports = {
  // Master Section
  createMasterSectionSchema,
  updateMasterSectionSchema,
  getMasterSectionSchema,
  paramsMasterSectionIdSchema,
  // Master Section Header
  createMasterSectionHeaderSchema,
  updateMasterSectionHeaderSchema,
  getMasterSectionHeaderSchema,
  paramsHeaderIdSchema,
  // Master Section Item
  createMasterSectionItemSchema,
  updateMasterSectionItemSchema,
  getMasterSectionItemSchema,
  paramsItemIdSchema,
};
