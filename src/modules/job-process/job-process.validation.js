import Joi from "joi";

const uuid = Joi.string().uuid();

/* =========================================================
   STAGE
========================================================= */

export var stageParamsSchema = Joi.object({
  stage_id: uuid.required(),
});

export var createStageSchema = Joi.object({
  name: Joi.string()
    .min(2)
    .max(200)
    .pattern(/^(?=.*[a-zA-Z])[a-zA-Z0-9\s,./#-]+$/)
    .required(),
  functionality_id: uuid.required(),
  sort_order: Joi.number().integer().min(1).required(),
  dependent_stage_id: uuid.allow(null),
});

export var updateStageSchema = Joi.object({
  name: Joi.string()
    .min(2)
    .max(200)
    .pattern(/^(?=.*[a-zA-Z])[a-zA-Z0-9\s,./#-]+$/)
    .optional(),
  sort_order: Joi.number().integer().min(1).optional(),
  functionality_id: uuid.optional(),
  dependent_stage_id: uuid.allow(null),
});

export var deleteSubStageSchema = Joi.object({
  task_id: uuid.optional(),
});

/* =========================================================
   SUB-STAGE
========================================================= */

export var subStageParamsSchema = Joi.object({
  sub_stage_id: uuid.required(),
});

export var createSubStageSchema = Joi.object({
  name: Joi.string()
    .min(2)
    .max(200)
    .pattern(/^(?=.*[a-zA-Z])[a-zA-Z0-9\s,./#-]+$/)
    .required(),
  sort_order: Joi.number().integer().min(1).required(),
});

export var updateSubStageSchema = Joi.object({
  name: Joi.string()
    .min(2)
    .max(200)
    .pattern(/^(?=.*[a-zA-Z])[a-zA-Z0-9\s,./#-]+$/)
    .optional(),
  sort_order: Joi.number().integer().min(1).optional(),
});

/* =========================================================
   TASK
========================================================= */

export var taskParamsSchema = Joi.object({
  task_id: uuid.required(),
});

export var createTaskSchema = Joi.object({
  name: Joi.string()
    .min(2)
    .max(200)
    .pattern(/^(?=.*[a-zA-Z])[a-zA-Z0-9\s,./#-]+$/)
    .required(),
  description: Joi.string().allow(null),
  sort_order: Joi.number().integer().min(1).required(),
  no_of_days: Joi.number().integer().allow(null),
  assignee_id: uuid.allow(null),
  folder_id: uuid.allow(null),
  notify: Joi.boolean().default(false),
  milestone: Joi.boolean().default(false),
  attachment_mandatory: Joi.boolean().default(false),
  predecessor_task_ids: Joi.array().items(uuid).default([]),
});

export var updateTaskSchema = Joi.object({
  name: Joi.string()
    .min(2)
    .max(200)
    .pattern(/^(?=.*[a-zA-Z])[a-zA-Z0-9\s,./#-]+$/)
    .optional(),
  description: Joi.string().allow(null),
  sort_order: Joi.number().integer().min(1).optional(),
  no_of_days: Joi.number().integer().allow(null),
  assignee_id: uuid.allow(null),
  folder_id: uuid.allow(null),
  notify: Joi.boolean().optional(),
  milestone: Joi.boolean().optional(),
  attachment_mandatory: Joi.boolean().optional(),
  predecessor_task_ids: Joi.array().items(uuid).optional(),
});

/* =========================================================
   SUB-TASK
========================================================= */

export var subTaskParamsSchema = Joi.object({
  sub_task_id: uuid.required(),
});

export var createSubTaskSchema = Joi.object({
  name: Joi.string()
    .min(2)
    .max(200)
    .pattern(/^(?=.*[a-zA-Z])[a-zA-Z0-9\s,./#-]+$/)
    .required(),
  sort_order: Joi.number().integer().min(1).required(),
});

export var updateSubTaskSchema = Joi.object({
  name: Joi.string()
    .min(2)
    .max(200)
    .pattern(/^(?=.*[a-zA-Z])[a-zA-Z0-9\s,./#-]+$/)
    .optional(),
  sort_order: Joi.number().integer().min(1).optional(),
});

/* =========================================================
   TASK DEPENDENCY
========================================================= */

export var deleteTaskDependencySchema = Joi.object({
  task_id: uuid.required(),
  predecessor_task_id: uuid.required(),
});

export default {
  stageParamsSchema,
  createStageSchema,
  updateStageSchema,
  deleteSubStageSchema,
  subStageParamsSchema,
  createSubStageSchema,
  updateSubStageSchema,
  taskParamsSchema,
  createTaskSchema,
  updateTaskSchema,
  subTaskParamsSchema,
  createSubTaskSchema,
  updateSubTaskSchema,
  deleteTaskDependencySchema,
};
