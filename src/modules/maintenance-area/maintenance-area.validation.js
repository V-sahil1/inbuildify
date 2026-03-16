import Joi from "joi";

const createMaintenanceAreaSchem = Joi.object({
  name: Joi.string()
    .trim()
    .min(2)
    .max(150)
    .pattern(/^(?=.*[a-zA-Z])[a-zA-Z0-9\s,./#-]+$/)
    .required(),
});

const getAllMaintenanceAreaSchema = Joi.object({
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

const deleteMaintenanceAreaSchema = Joi.object({
  maintenance_area_id: Joi.string().uuid().required().messages({
    "string.guid": "Maintenance area ID must be a valid UUID",
    "any.required": "Maintenance area ID  is required",
  }),
});

const updateMaintenanceAreaParamsSchema = Joi.object({
  maintenance_area_id: Joi.string().uuid().required().messages({
    "string.guid": "Maintenance area ID must be a valid UUID",
    "any.required": "Maintenance area ID  is required",
  }),
});

const updateMaintenanceAreaSchema = Joi.object({
  name: Joi.string()
    .trim()
    .min(2)
    .max(150)
    .pattern(/^(?=.*[a-zA-Z])[a-zA-Z0-9\s,./#-]+$/)
    .optional(),
});

export default {
  createMaintenanceAreaSchem,
  getAllMaintenanceAreaSchema,
  deleteMaintenanceAreaSchema,
  updateMaintenanceAreaParamsSchema,
  updateMaintenanceAreaSchema,
};
