import Joi from "joi";

const createDriveSchema = Joi.object({
  name: Joi.string().required().messages({
    "string.empty": "Name is required",
    "any.required": "Name is required",
  }),
});

const getAllDriveSchema = Joi.object({
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

const updateIdParamsSchema = Joi.object({
  drive_id: Joi.string().uuid().required().messages({
    "string.guid": "drive id must be a valid UUID",
    "any.required": "drive id is required",
  }),
});
const updateDriveSchema = Joi.object({
  name: Joi.string().required().messages({
    "string.empty": "Name is required",
    "any.required": "Name is required",
  }),
});

export default {
  createDriveSchema,
  updateDriveSchema,
  updateIdParamsSchema,
  getAllDriveSchema,
};
