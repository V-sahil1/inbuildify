const Joi = require("joi");

const uuid = Joi.string().uuid();

/* =========================================================
   STAGE
========================================================= */

exports.stageParamsSchema = Joi.object({
  stage_id: uuid.required(),
});

exports.createStageSchema = Joi.object({
  name: Joi.string().max(200).required(),
  functionality_id: uuid.required(),
  sort_order: Joi.number().integer().min(1).required(),
  dependent_stage_id: uuid.allow(null),
});

exports.updateStageSchema = Joi.object({
  name: Joi.string().max(200).optional(),
  sort_order: Joi.number().integer().min(1).optional(),
  functionality_id: uuid.optional(),
  dependent_stage_id: uuid.allow(null),
});

/* =========================================================
   SUB-STAGE
========================================================= */

exports.subStageParamsSchema = Joi.object({
  sub_stage_id: uuid.required(),
});

exports.createSubStageSchema = Joi.object({
  name: Joi.string().max(200).required(),
  sort_order: Joi.number().integer().min(1).required(),
});

exports.updateSubStageSchema = Joi.object({
  name: Joi.string().max(200).optional(),
  sort_order: Joi.number().integer().min(1).optional(),
});

/* =========================================================
   TASK
========================================================= */

exports.taskParamsSchema = Joi.object({
  task_id: uuid.required(),
});

exports.createTaskSchema = Joi.object({
  name: Joi.string().max(200).required(),
  description: Joi.string().allow(null),
  sort_order: Joi.number().integer().min(1).required(),
  no_of_days: Joi.number().integer().allow(null),
  assignee_id: uuid.allow(null),
  notify: Joi.boolean().default(false),
  milestone: Joi.boolean().default(false),
  attachment_mandatory: Joi.boolean().default(false),
  predecessor_task_ids: Joi.array().items(uuid).default([]),
});

exports.updateTaskSchema = Joi.object({
  name: Joi.string().max(200).optional(),
  description: Joi.string().allow(null),
  sort_order: Joi.number().integer().min(1).optional(),
  no_of_days: Joi.number().integer().allow(null),
  assignee_id: uuid.allow(null),
  notify: Joi.boolean().optional(),
  milestone: Joi.boolean().optional(),
  attachment_mandatory: Joi.boolean().optional(),
  predecessor_task_ids: Joi.array().items(uuid).optional(),
});

/* =========================================================
   SUB-TASK
========================================================= */

exports.subTaskParamsSchema = Joi.object({
  sub_task_id: uuid.required(),
});

exports.createSubTaskSchema = Joi.object({
  name: Joi.string().max(200).required(),
  sort_order: Joi.number().integer().min(1).required(),
});

exports.updateSubTaskSchema = Joi.object({
  name: Joi.string().max(200).optional(),
  sort_order: Joi.number().integer().min(1).optional(),
});
