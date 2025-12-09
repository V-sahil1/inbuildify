const Joi = require("joi");

const createDocumentFolderMappingSchema = Joi.object({
  mapping_type: Joi.string()
    .valid(
      "signed_quotation",
      "signed_color",
      "signed_variation",
      "signed_maintenance",
      "signed_contract_document",
      "compliance_certificate",
      "purchase_order",
      "job_documents"
    )
    .required(),

  folder_id: Joi.string().uuid().optional(),
  select_all_files_from_folder: Joi.boolean().default(false),
});

const getAllDocumentFolderMappingsSchema = Joi.object({
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

const updateDocumentFolderMappingParamsSchema = Joi.object({
  document_folder_mapping_id: Joi.string().uuid().uuid().messages({
    "string.guid": "Document folder mapping ID must be a valid UUID",
    "any.required": "Document folder mapping ID is required",
  }),
});

const updateDocumentFolderMappingSchema = Joi.object({
  mapping_type: Joi.string()
    .valid(
      "signed_quotation",
      "signed_color",
      "signed_variation",
      "signed_maintenance",
      "signed_contract_document",
      "compliance_certificate",
      "purchase_order",
      "job_documents"
    )
    .optional(),

  folder_id: Joi.string().uuid().optional(),
  select_all_files_from_folder: Joi.boolean().default(false),
});

const deleteDocumentFolderMappingSchema = Joi.object({
  document_folder_mapping_id: Joi.string().uuid().uuid().messages({
    "string.guid": "Document folder mapping ID must be a valid UUID",
    "any.required": "Document folder mapping ID is required",
  }),
});

module.exports = {
  createDocumentFolderMappingSchema,
  getAllDocumentFolderMappingsSchema,
  updateDocumentFolderMappingParamsSchema,
  updateDocumentFolderMappingSchema,
  deleteDocumentFolderMappingSchema,
};
