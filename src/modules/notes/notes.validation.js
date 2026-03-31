import Joi from "joi";

export const createNoteSchema = Joi.object({
  leads_id: Joi.string().uuid().required().messages({
    "string.uuid": "leads_id must be a valid UUID",
    "any.required": "leads_id is required",
  }),
  description: Joi.string().max(500).allow(null, "").optional().messages({
    "string.max": "description must be at most 500 characters",
  }),
  note_tag_id: Joi.array().items(Joi.string().uuid()).optional().messages({
    "array.base": "note_tag_id must be an array of UUIDs",
  }),
  send_to_customer: Joi.boolean().optional(),
  create_follow_up_task: Joi.boolean().optional(),
  task_name: Joi.string().max(200).when("create_follow_up_task", {
    is: true,
    then: Joi.required(),
    otherwise: Joi.optional(),
  }).messages({
    "any.required": "task_name is required when creating a follow-up task",
  }),
  due_date: Joi.date().iso().when("create_follow_up_task", {
    is: true,
    then: Joi.required(),
    otherwise: Joi.optional(),
  }).messages({
    "any.required": "due_date is required when creating a follow-up task",
  }),
  attach_file: Joi.any().optional(), // Handled by multer, but can be passed in req.file
});

export const updateNoteSchema = Joi.object({
  description: Joi.string().max(500).allow(null, "").optional(),
  note_tag_id: Joi.array().items(Joi.string().uuid()).optional(),
  send_to_customer: Joi.boolean().optional(),
  create_follow_up_task: Joi.boolean().optional(),
  attach_file: Joi.any().optional(),
});

export const getAllNotesSchema = Joi.object({
  leads_id: Joi.string().uuid().optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(25),
});

export const noteParamsSchema = Joi.object({
  notes_id: Joi.string().uuid().required().messages({
    "string.uuid": "notes_id must be a valid UUID",
    "any.required": "notes_id is required",
  }),
});

export default {
  createNoteSchema,
  updateNoteSchema,
  getAllNotesSchema,
  noteParamsSchema,
};
