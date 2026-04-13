import Joi from "joi";

export const createTodoSchema = Joi.object({
  job_id: Joi.string().uuid().allow(null, "").optional(),
  task_name: Joi.string().min(1).max(255).required(),
  supplier_id: Joi.string().uuid().required(),
  booking_date: Joi.date().allow(null).optional(),
  start_date: Joi.date().allow(null).optional(),
  finish_date: Joi.date().allow(null).optional(),
  site_supervisor_id: Joi.string().uuid().allow(null, "").optional(),
  subject: Joi.string().max(500).allow(null, "").optional(),
  message: Joi.string().allow(null, "").optional(),
  status: Joi.string().valid("Pending", "Confirmed", "Cancelled").default("Pending"),
});

export const getAllTodosSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(25),
  task_name: Joi.string().max(255).optional(),
  job_address: Joi.string().max(500).optional(),
  site_supervisor_id: Joi.string().uuid().optional(),
  supplier_id: Joi.alternatives()
    .try(
      Joi.string().uuid(),
      Joi.string().pattern(
        /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}(,[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})*$/
      ),
      Joi.array().items(Joi.string().uuid())
    )
    .optional(),
  booking_date_from: Joi.date().allow(null).optional(),
  booking_date_to: Joi.date().allow(null).optional(),
  start_date_from: Joi.date().allow(null).optional(),
  start_date_to: Joi.date().allow(null).optional(),
  status: Joi.string().valid("Pending", "Confirmed", "Cancelled").optional(),
  date_filter: Joi.string()
    .valid("today", "tomorrow", "this_week", "next_week", "overdue")
    .optional(),
});

export const todoIdParamSchema = Joi.object({
  todo_id: Joi.string().uuid().required().messages({
    "string.guid": "Todo ID must be a valid UUID",
    "any.required": "Todo ID is required",
  }),
});

export const updateTodoSchema = Joi.object({
  job_id: Joi.string().uuid().allow(null, "").optional(),
  task_name: Joi.string().min(1).max(255).optional(),
  supplier_id: Joi.string().uuid().allow(null, "").optional(),
  booking_date: Joi.date().allow(null).optional(),
  start_date: Joi.date().allow(null).optional(),
  finish_date: Joi.date().allow(null).optional(),
  site_supervisor_id: Joi.string().uuid().allow(null, "").optional(),
  subject: Joi.string().max(500).allow(null, "").optional(),
  message: Joi.string().allow(null, "").optional(),
  status: Joi.string().valid("Pending", "Confirmed", "Cancelled").optional(),
});

export default { createTodoSchema, getAllTodosSchema, todoIdParamSchema, updateTodoSchema };
