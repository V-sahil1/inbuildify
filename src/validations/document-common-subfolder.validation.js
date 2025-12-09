const Joi = require("joi");

const createDocumentCommonSubfolderSchem = Joi.object({
  document_common_folder_id: Joi.string().uuid().required().messages({
    "string.guid": "Document common folder ID must be a valid UUID",
    "any.required": "Document common folder ID is required",
  }),

  name: Joi.string().trim().max(150).required().messages({
    "string.base": "Name must be a string.",
    "string.max": "Name cannot exceed 150 characters.",
  }),
  sort_order: Joi.number().integer().default(0).min(0).optional(),
});

const getDocumentCommonSubfolderByFolderIdParamsSchema = Joi.object({
  document_common_folder_id: Joi.string().uuid().required().messages({
    "string.guid": "Document common folder ID must be a valid UUID",
    "any.required": "Document common folder ID is required",
  }),
});

const getDocumentCommonSubfolderByFolderIdSchema = Joi.object({
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

const deleteDocumentCommonSubfolderSchema = Joi.object({
  document_common_subfolder_id: Joi.string().uuid().required().messages({
    "string.guid": "Document common subfolder ID must be a valid UUID",
    "any.required": "Document common subfolder ID is required",
  }),
});

const updateDocumentCommonSubfolderParamsSchema = Joi.object({
  document_common_subfolder_id: Joi.string().uuid().required().messages({
    "string.guid": "Document common subfolder ID must be a valid UUID",
    "any.required": "Document common subfolder ID is required",
  }),
});

const updateDocumentCommonSubfolderSchema = Joi.object({
  name: Joi.string().trim().max(150).optional().messages({
    "string.base": "Name must be a string.",
    "string.max": "Name cannot exceed 150 characters.",
  }),
  sort_order: Joi.number().integer().default(0).min(0).optional(),
});

module.exports = {
  createDocumentCommonSubfolderSchem,
  getDocumentCommonSubfolderByFolderIdParamsSchema,
  getDocumentCommonSubfolderByFolderIdSchema,
  deleteDocumentCommonSubfolderSchema,
  updateDocumentCommonSubfolderParamsSchema,
  updateDocumentCommonSubfolderSchema,
};
