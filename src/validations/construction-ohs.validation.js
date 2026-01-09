const Joi = require("joi");

/* ========================
   SETTINGS VALIDATION
======================== */

const upsertSettingsSchema = Joi.object({
  signature_required: Joi.boolean().optional(),
  minimum_audits: Joi.number().integer().min(0).optional()
});

/* ========================
   LIST ITEM VALIDATION
======================== */

const createListItemSchema = Joi.object({
  field_type: Joi.string().valid("category", "item").required(),
  description: Joi.string().max(500).required(),
  sort_order: Joi.number().integer().min(1).optional(),
  parent_id: Joi.string().uuid().optional().allow(null),
  add_defaults: Joi.boolean().optional()
});

const updateListItemSchema = Joi.object({
  description: Joi.string().max(500).optional(),
  sort_order: Joi.number().integer().min(1).optional(),
  add_defaults: Joi.boolean().optional(),
}).min(1);

module.exports = {
  upsertSettingsSchema,
  createListItemSchema,
  updateListItemSchema
};
