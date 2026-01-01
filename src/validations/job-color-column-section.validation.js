const Joi = require("joi");

const createJobColorColumnSectionSchema = Joi.object({
  section_name: Joi.string().trim().max(150).required(),
  attachment: Joi.string().max(500).allow(null, "").optional(),
  sort_order: Joi.number().integer().min(1).default(1).optional(),
});

const getJobColorColumnSectionsSchema = Joi.object({
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

const deleteJobColorColumnSectionSchema = Joi.object({
  job_color_column_section_id: Joi.string().uuid().required().messages({
    "string.guid": "Job color column section ID must be a valid UUID",
    "any.required": "job color column section ID is required",
  }),
});

const updateJobColorColumnSectionParamsSchema = Joi.object({
  job_color_column_section_id: Joi.string().uuid().required().messages({
    "string.guid": "Job color column section ID must be a valid UUID",
    "any.required": "job color column section ID is required",
  }),
});

const updateJobColorColumnSectionSchema = Joi.object({
  section_name: Joi.string().trim().max(150).optional(),
  attachment: Joi.string().max(500).allow(null, "").optional(),
  sort_order: Joi.number().integer().min(1).default(1).optional(),
});
module.exports = {
  createJobColorColumnSectionSchema,
  getJobColorColumnSectionsSchema,
  deleteJobColorColumnSectionSchema,
  updateJobColorColumnSectionParamsSchema,
  updateJobColorColumnSectionSchema,
};
