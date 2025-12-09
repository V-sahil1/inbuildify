const Joi = require("joi");

const createSchedulerSettingsSchema = Joi.object({
  receiver_of_replies: Joi.array()
    .items(Joi.string().guid({ version: "uuidv4" }))
    .optional()
    .messages({
      "string.guid": "Each receiver_of_replies must be a valid UUID",
    }),
});

const updateSchedulerSettingParamsSchema = Joi.object({
  scheduler_settings_id: Joi.string().uuid().required().messages({
    "string.guid": "Scheduler setting ID must be a valid UUID",
    "any.required": "Scheduler setting ID is required",
  }),
});

const updateSchedulerSettingSchema = Joi.object({
  receiver_of_replies: Joi.array()
    .items(Joi.string().guid({ version: "uuidv4" }))
    .optional()
    .messages({
      "string.guid": "Each receiver_of_replies must be a valid UUID",
    }),
});

module.exports = {
  createSchedulerSettingsSchema,
  updateSchedulerSettingParamsSchema,
  updateSchedulerSettingSchema,
};
