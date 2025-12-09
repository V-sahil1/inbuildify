const Joi = require("joi");

const createJobSettingsSchema = Joi.object({
  auto_move_to_maintenance: Joi.boolean().optional(),
  auto_mark_completed: Joi.boolean().optional(),
  auto_archive_after_completion: Joi.boolean().optional(),
  auto_archive_after_days: Joi.number().integer().min(0).allow(null).optional(),
  milestone_status_check_days: Joi.number()
    .integer()
    .min(0)
    .allow(null)
    .optional(),
  report_custom_days: Joi.number().integer().min(0).allow(null).optional(),
  report_status_filter: Joi.string()
    .valid("all", "active", "completed", "archived")
    .default("all")
    .optional(),
  report_include_date: Joi.boolean().optional(),
});

const updateJobSettingParamsSchema = Joi.object({
  job_settings_id: Joi.string().uuid().required().messages({
    "string.guid": "ID must be a valid UUID",
    "any.required": "ID is required",
  }),
});

const updateJobSettingSchema = Joi.object({
  auto_move_to_maintenance: Joi.boolean().optional(),
  auto_mark_completed: Joi.boolean().optional(),
  auto_archive_after_completion: Joi.boolean().optional(),
  auto_archive_after_days: Joi.number().integer().min(0).allow(null).optional(),
  milestone_status_check_days: Joi.number()
    .integer()
    .min(0)
    .allow(null)
    .optional(),
  report_custom_days: Joi.number().integer().min(0).allow(null).optional(),
  report_status_filter: Joi.string()
    .valid("all", "active", "completed", "archived")
    .default("all")
    .optional(),
  report_include_date: Joi.boolean().optional(),
});

module.exports = {
  createJobSettingsSchema,
  updateJobSettingParamsSchema,
  updateJobSettingSchema,
};
