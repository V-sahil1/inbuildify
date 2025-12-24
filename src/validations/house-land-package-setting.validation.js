const Joi = require("joi");

const createHouseLandPackageSettingSchema = Joi.object({
  include_facade_cost_in_total: Joi.boolean().default(false),
});

const updateHouseLandPackageSettingParamsSchema = Joi.object({
  id: Joi.string().uuid().required().messages({
    "string.guid": "ID must be a valid UUID",
    "any.required": "ID is required",
  }),
});

const updateHouseLandPackageSettingSchems = Joi.object({
  include_facade_cost_in_total: Joi.bool().default(false),
});

module.exports = {
  createHouseLandPackageSettingSchema,
  updateHouseLandPackageSettingParamsSchema,
  updateHouseLandPackageSettingSchems,
};
