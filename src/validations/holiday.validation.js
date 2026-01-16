const Joi = require("joi");

const createHolidaySchema = Joi.object({
  state: Joi.array()
    .items(Joi.string().guid({ version: "uuidv4" }))
    .optional()
    .messages({
      "string.guid": "state id must be a valid UUID",
    }),
  holiday_start_date: Joi.date().required(),
  holiday_end_date: Joi.date().required(),
  holiday_description: Joi.string().trim().max(500).required(),
});

const getAllHolidaySchema = Joi.object({
  state: Joi.string()
    .custom((value, helpers) => {
      const parts = value.split(",").map((v) => v.trim());

      for (const id of parts) {
        if (!/^[0-9a-fA-F-]{36}$/.test(id)) {
          return helpers.error("string.guid");
        }
      }

      return value;
    })
    .messages({
      "string.guid": "Each state id must be a valid UUID.",
      "string.base": "state must be comma-separated UUID string.",
    })
    .optional(),
  holiday_start_date: Joi.date().optional(),
  holiday_end_date: Joi.date().optional(),
  holiday_description: Joi.string().trim().max(500).optional(),
  status: Joi.boolean().default(true),
  page: Joi.number().integer().min(1).default(1).messages({
    "number.base": "Page must be a number",
    "number.integer": "Page must be an integer",
    "number.min": "Page must be greater than 0",
  }),

  limit: Joi.number().integer().min(1).max(100).default(10).messages({
    "number.base": "Limit must be a number",
    "number.integer": "Limit must be an integer",
    "number.min": "Limit must be at least 1",
    "number.max": "Limit must not exceed 100",
  }),
});

const deleteHolidaySchema = Joi.object({
  id: Joi.string().uuid().required().messages({
    "string.guid": "holiday ID must be a valid UUID",
    "any.required": "holiday ID is required",
  }),
});

const updateHolidayParamsSchema = Joi.object({
  holiday_id: Joi.string().uuid().required().messages({
    "string.guid": "holiday ID must be a valid UUID",
    "any.required": "holiday ID is required",
  }),
});

const updateHolidaySchema = Joi.object({
  state: Joi.array()
    .items(Joi.string().guid({ version: "uuidv4" }))
    .optional()
    .messages({
      "string.guid": "state id must be a valid UUID",
    }),
  holiday_start_date: Joi.date().optional(),
  holiday_end_date: Joi.date().optional(),
  holiday_description: Joi.string().trim().max(500).optional(),
  status: Joi.boolean().optional(),
});
module.exports = {
  createHolidaySchema,
  getAllHolidaySchema,
  deleteHolidaySchema,
  updateHolidayParamsSchema,
  updateHolidaySchema,
};
