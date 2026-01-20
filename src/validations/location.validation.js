const Joi = require("joi");

const createLocationSchema = Joi.object({
  name: Joi.string().trim().max(150).required(),
  status: Joi.boolean().default(true),
});

const deleteLocationSchema = Joi.object({
  location_id: Joi.string().uuid().required().messages({
    "string.guid": "location ID must be a valid UUID",
    "any.required": "location ID is required",
  }),
});

const updateLocationParamsSchema = Joi.object({
  location_id: Joi.string().uuid().required().messages({
    "string.guid": "location ID must be a valid UUID",
    "any.required": "location ID is required",
  }),
});

const updateLocationShema = Joi.object({
  name: Joi.string().trim().max(150).optional(),
  status: Joi.boolean().optional(),
});

module.exports = {
  createLocationSchema,
  deleteLocationSchema,
  updateLocationParamsSchema,
  updateLocationShema,
};
