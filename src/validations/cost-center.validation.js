const Joi = require("joi");

const createCostCenterSchema = Joi.object({
  code: Joi.string().max(100).required(),
  name: Joi.string().max(255).required(),
  description: Joi.string().max(500).optional(),
  sortOrder: Joi.number().integer().min(1).optional(),
  status: Joi.boolean().optional()
});

const updateCostCenterSchema = Joi.object({
  code: Joi.string().max(100).optional(),
  name: Joi.string().max(255).optional(),
  description: Joi.string().max(500).optional(),
  sortOrder: Joi.number().integer().min(1).optional(),
  status: Joi.boolean().optional()
});

const costCenterParamsSchema = Joi.object({
  cost_center_id: Joi.string().uuid().required()
});

module.exports = {
  createCostCenterSchema,
  updateCostCenterSchema,
  costCenterParamsSchema
};