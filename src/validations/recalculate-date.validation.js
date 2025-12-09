const Joi = require("joi");

const createRecalculateDateSchema = Joi.object({
  recalculate_workflow_job_estimated_dates: Joi.boolean().default(false),
  recalculate_construction_job_estimated_dates: Joi.boolean().default(false),
  capture_reason_rebooking_and_rebooking_email: Joi.boolean().default(false),
  capture_text: Joi.string().trim().max(500).optional(),
  recalculate_confirmed_booking_dates: Joi.boolean().default(false),
});

const updateRecalculateDateParamsSchema = Joi.object({
  recalculate_date_id: Joi.string().uuid().required().messages({
    "string.guid": "Recalculate date ID must be a valid UUID",
    "any.required": "Recalculate date ID is required",
  }),
});

const updateRecalculateDateSchema = Joi.object({
  recalculate_workflow_job_estimated_dates: Joi.boolean().optional(),
  recalculate_construction_job_estimated_dates: Joi.boolean().optional(),
  capture_reason_rebooking_and_rebooking_email: Joi.boolean().optional(),
  capture_text: Joi.string().trim().max(500).optional(),
  recalculate_confirmed_booking_dates: Joi.boolean().optional(),
});
module.exports = {
  createRecalculateDateSchema,
  updateRecalculateDateParamsSchema,
  updateRecalculateDateSchema,
};
