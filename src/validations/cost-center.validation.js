const Joi = require("joi");

const createCostCenterSchema = Joi.object({
  code: Joi.string().min(5).max(10).required(),
  name: Joi.string()
    .min(2)
    .max(255)
    .pattern(/^(?=.*[a-zA-Z])[a-zA-Z0-9\s,./#-]+$/)
    .required(),
  description: Joi.string()
    .min(2)
    .max(500)
    .pattern(/^[^<>]*$/)
    .optional(),
  sort_order: Joi.number().integer().min(1).optional(),
  status: Joi.boolean().optional(),
});

const updateCostCenterSchema = Joi.object({
  code: Joi.string().min(5).max(10).optional(),
  name: Joi.string()
    .min(2)
    .max(255)
    .pattern(/^(?=.*[a-zA-Z])[a-zA-Z0-9\s,./#-]+$/)
    .optional(),
  description: Joi.string()
    .max(500)
    .pattern(/^[^<>]*$/)
    .allow("", null)
    .optional(),
  sort_order: Joi.number().integer().min(1).optional(),
  status: Joi.boolean().optional(),
});

const costCenterParamsSchema = Joi.object({
  cost_center_id: Joi.string().uuid().required(),
});

const createCostCenterChecklistMapSchema = Joi.object({
  cost_center_id: Joi.string().uuid().required(),
  construction_checklist_id: Joi.string().uuid().required(),
});

const costCenterChecklistMapQuerySchema = Joi.object({
  cost_center_id: Joi.string().uuid().optional(),
  construction_checklist_id: Joi.string().uuid().optional(),
});

const costCenterChecklistMapParamsSchema = Joi.object({
  id: Joi.string().uuid().required(),
});

const getAllCostCentersSchema = Joi.object({
  code: Joi.string().max(10).optional(),
  name: Joi.string().max(255).optional(),
  description: Joi.string().max(500).optional(),
  sort_order: Joi.number().integer().min(1).optional(),
  status: Joi.boolean().optional(),
});

module.exports = {
  createCostCenterSchema,
  updateCostCenterSchema,
  costCenterParamsSchema,
  createCostCenterChecklistMapSchema,
  costCenterChecklistMapQuerySchema,
  costCenterChecklistMapParamsSchema,
  getAllCostCentersSchema,
};
