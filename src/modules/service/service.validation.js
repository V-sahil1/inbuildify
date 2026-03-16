import Joi from "joi";

const serviceRule = Joi.string()
  .min(2)
  .max(100)
  .trim()
  .pattern(/^[a-zA-Z0-9\s&.-]+$/)
  .messages({
    "string.base": "Service must be a string",
    "string.empty": "Service name is required",
    "string.min": "Service name must be at least 2 characters long",
    "string.max": "Service name must not exceed 100 characters",
    "string.pattern.base":
      "Service name can only contain letters, numbers, spaces, &, ., and -",
    "any.required": "Service name is required",
  });

const serviceIdRule = Joi.string().uuid().messages({
  "string.base": "Service ID must be a string",
  "string.empty": "Service ID is required",
  "string.guid": "Service ID must be a valid UUID",
  "any.required": "Service ID is required",
});

const createServiceSchema = Joi.object({
  service: serviceRule.required(),
});

const getServiceByIdSchema = Joi.object({
  service_id: serviceIdRule.required(),
});

const updateServiceSchema = Joi.object({
  service: serviceRule.required(),
});

const updateServiceParamsSchema = Joi.object({
  service_id: serviceIdRule.required(),
});

const deleteServiceSchema = Joi.object({
  service_id: serviceIdRule.required(),
});

export default {
  createServiceSchema,
  getServiceByIdSchema,
  updateServiceSchema,
  updateServiceParamsSchema,
  deleteServiceSchema,
};
