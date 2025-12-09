const Joi = require("joi");

const createLocationSchema = Joi.object({
  name: Joi.string().trim().max(150).required(),
  status: Joi.boolean().default(true),
});

const getAllLocationSchema = Joi.object({
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

const deleteLocationSchema = Joi.object({
  location_id: Joi.string().uuid().required().messages({
    "string.guid": "location ID must be a valid UUID",
    "any.required": "location ID is required",
  }),
});

const updateLocationParamsSchema = Joi.object({
  location_id: Joi.string().uuid().required().messages({
    "string.guid": "location ID must be a valid UUID",
    "any.required": "location ID is required",
  }),
});

const updateLocationShema = Joi.object({
  name: Joi.string().trim().max(150).optional(),
  status: Joi.boolean().optional(),
});

module.exports = {
  createLocationSchema,
  getAllLocationSchema,
  deleteLocationSchema,
  updateLocationParamsSchema,
  updateLocationShema,
};
