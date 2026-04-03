import Joi from "joi";

export const createStructureEngineerSchema = Joi.object({
  name: Joi.string().max(255).required().messages({
    "any.required": "Name is required",
    "string.empty": "Name cannot be empty",
  }),
  email: Joi.string().email().allow(null, "").max(255).optional().messages({
    "string.email": "Email must be a valid email address",
  }),
  phone: Joi.string().allow(null, "").min(10).max(15).optional(),
  address: Joi.string().allow(null, "").max(500).optional(),
  is_active: Joi.boolean().default(true).optional(),
});

export const updateStructureEngineerSchema = Joi.object({
  name: Joi.string().max(255).optional(),
  email: Joi.string().email().allow(null, "").max(255).optional().messages({
    "string.email": "Email must be a valid email address",
  }),
  phone: Joi.string().allow(null, "").min(10).max(15).optional(),
  address: Joi.string().allow(null, "").max(500).optional(),
  is_active: Joi.boolean().optional(),
});

export const getStructureEngineerByIdSchema = Joi.object({
  structure_engineer_id: Joi.string().uuid().required().messages({
    "string.guid": "Structure Engineer ID must be a valid UUID",
    "any.required": "Structure Engineer ID is required",
  }),
});

export const getAllStructureEngineerSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).default(25),
  search: Joi.string().allow(null, "").optional(),
});

export const deleteStructureEngineerSchema = Joi.object({
  structure_engineer_id: Joi.string().uuid().required().messages({
    "string.guid": "Structure Engineer ID must be a valid UUID",
    "any.required": "Structure Engineer ID is required",
  }),
});

export default {
  createStructureEngineerSchema,
  updateStructureEngineerSchema,
  getStructureEngineerByIdSchema,
  getAllStructureEngineerSchema,
  deleteStructureEngineerSchema,
};
