import Joi from "joi";

const createScreenSchema = Joi.object({
  name: Joi.string().trim().min(3).max(150).required().messages({
    "any.required": "name is required",
  }),
});

const deleteScreenSchema = Joi.object({
  screen_id: Joi.string().uuid().required().messages({
    "string.guid": "Surveyor ID must be a valid UUID",
    "any.required": "Surveyor ID is required",
  }),
});

const updateScreenParamsSchema = Joi.object({
  screen_id: Joi.string().uuid().required().messages({
    "string.guid": "Surveyor ID must be a valid UUID",
    "any.required": "Surveyor ID is required",
  }),
});

const updateScreenSchema = Joi.object({
  name: Joi.string().trim().min(3).max(150).required(),
});

export default {
  createScreenSchema,
  deleteScreenSchema,
  updateScreenParamsSchema,
  updateScreenSchema,
};
