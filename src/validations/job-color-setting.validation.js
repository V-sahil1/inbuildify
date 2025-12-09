const Joi = require("joi");

const createJobColorSettingSchema = Joi.object({
  hide_color_item_images: Joi.boolean().default(false),
  hide_color_item_price: Joi.boolean().default(false),
  exit_color_code: Joi.boolean().default(false),
  page_orientation_portrait: Joi.boolean().default(true),
  header_text: Joi.string().trim().max(500).optional(),
});

const updateJobColorSettingParamsSchema = Joi.object({
  id: Joi.string().uuid().required().messages({
    "string.guid": "Surveyor ID must be a valid UUID",
    "any.required": "Surveyor ID is required",
  }),
});

const updateJobColorSettingSchema = Joi.object({
  hide_color_item_images: Joi.boolean().default(false),
  hide_color_item_price: Joi.boolean().default(false),
  exit_color_code: Joi.boolean().default(false),
  page_orientation_portrait: Joi.boolean().default(true),
  header_text: Joi.string().trim().max(500).optional(),
});
module.exports = {
  createJobColorSettingSchema,
  updateJobColorSettingParamsSchema,
  updateJobColorSettingSchema,
};
