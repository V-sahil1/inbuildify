const Joi = require("joi");

const createInclusionPackageSchema = Joi.object({
  name: Joi.string().max(255).required().messages({
    "string.max": "Name must not exceed 255 characters",
    "any.required": "Name is required",
  }),
});

const updateInclusionPackageSchema = Joi.object({
  name: Joi.string().max(255).optional().messages({
    "string.max": "Name must not exceed 255 characters",
  }),
});

const inclusionPackageIdSchema = Joi.object({
  id: Joi.string().uuid().required().messages({
    "string.guid": "Inclusion Package ID must be a valid UUID",
    "any.required": "Inclusion Package ID is required",
  }),
});

module.exports = {
  createInclusionPackageSchema,
  updateInclusionPackageSchema,
  inclusionPackageIdSchema,
};
