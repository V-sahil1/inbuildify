const Joi = require("joi");

const uuidRule = Joi.string().uuid().required().messages({
  "string.guid": "ID must be a valid UUID",
  "any.required": "ID is required",
});

const stringRule = Joi.string().trim().messages({
  "string.base": "Must be a string",
  "string.empty": "Field cannot be empty",
});

const createLotPackageGroupSchema = Joi.object({
  group_name: stringRule.max(255).required().messages({
    "any.required": "Group name is required",
    "string.max": "Group name must not exceed 255 characters",
  }),
});

const updateLotPackageGroupSchema = Joi.object({
  group_name: stringRule.max(255).required().messages({
    "any.required": "Group name is required",
    "string.max": "Group name must not exceed 255 characters",
  }),
});

const getLotPackageGroupByIdSchema = Joi.object({
  lot_package_group_id: uuidRule,
});

const deleteLotPackageGroupSchema = Joi.object({
  lot_package_group_id: uuidRule.messages({
    "string.guid": "Lot package group ID must be a valid UUID",
    "any.required": "Lot package group ID is required",
  }),
});

const getAllLotPackageGroupsSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(25),
  search: Joi.string().trim().optional().allow(""),
});

module.exports = {
  createLotPackageGroupSchema,
  updateLotPackageGroupSchema,
  getLotPackageGroupByIdSchema,
  deleteLotPackageGroupSchema,
  getAllLotPackageGroupsSchema,
};
