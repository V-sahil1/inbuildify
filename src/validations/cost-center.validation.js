const Joi = require("joi");

const createCostCenterSchema = Joi.object({
  code: Joi.string().max(10).required(),
  name: Joi.string().max(255).required(),
  description: Joi.string().max(500).optional(),
  sort_order: Joi.number().integer().min(1).optional(),
  status: Joi.boolean().optional(),
});

const updateCostCenterSchema = Joi.object({
  code: Joi.string().max(100).optional(),
  name: Joi.string().max(255).optional(),
  description: Joi.string().max(500).optional(),
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

module.exports = {
  createCostCenterSchema,
  updateCostCenterSchema,
  costCenterParamsSchema,
  createCostCenterChecklistMapSchema,
  costCenterChecklistMapQuerySchema,
  costCenterChecklistMapParamsSchema,
};
