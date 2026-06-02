import Joi from "joi";

const VALID_PERMISSION_LEVELS = ["VIEW", "EDIT", "ADMIN"];
const VALID_ENTITY_TYPES = ["folder", "file"];

export const createShareSchema = Joi.object({
  entity_type: Joi.string().valid(...VALID_ENTITY_TYPES).required(),
  entity_id: Joi.string().uuid().required(),
  shared_with_user: Joi.string().uuid().required(),
  permission_level: Joi.string().valid(...VALID_PERMISSION_LEVELS).required(),
});

export const updateShareSchema = Joi.object({
  permission_level: Joi.string().valid(...VALID_PERMISSION_LEVELS).required(),
});
