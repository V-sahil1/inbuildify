const Joi = require("joi");

const createDocumentFileNamingRuleSchema = Joi.object({
  file_type: Joi.string().trim().max(150).required().messages({
    "string.base": "File type must be a string.",
    "string.empty": "File type is required.",
    "any.required": "File type is required.",
  }),

  folder_ids: Joi.array()
    .items(
      Joi.string()
        .guid({ version: ["uuidv4"] })
        .messages({ "string.guid": "Each folder_id must be a valid UUID." })
    )
    .default([])
    .messages({
      "array.base": "Folder IDs must be an array of UUIDs.",
    }),


});

const getAllDocumentFileNamingRulesSchema = Joi.object({
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

const deleteDocumentFileNamingRuleSchema = Joi.object({
  document_file_naming_rule_id: Joi.string().uuid().required().messages({
    "string.guid": "Document file naming rule ID must be a valid UUID",
    "any.required": "Document file naming rule ID is required",
  }),
});

const updateDocumentFileNamingRuleParamsSchema = Joi.object({
  document_file_naming_rule_id: Joi.string().uuid().required().messages({
    "string.guid": "Document file naming rule ID must be a valid UUID",
    "any.required": "Document file naming rule ID is required",
  }),
});

const updateDocumentFileNamingRuleSchema = Joi.object({
  file_type: Joi.string().trim().max(150).optional().messages({
    "string.base": "File type must be a string.",
  }),

  folder_ids: Joi.array()
    .items(
      Joi.string()
        .optional()
        .guid({ version: ["uuidv4"] })
        .messages({ "string.guid": "Each folder_id must be a valid UUID." })
    )
    .default([])
    .messages({
      "array.base": "Folder IDs must be an array of UUIDs.",
    }),
});

const updateNamingFormatSchema = Joi.object({
  naming_format: Joi.string().trim().max(255).required().messages({
    "string.base": "Naming format must be a string.",
    "string.empty": "Naming format is required.",
    "any.required": "Naming format is required.",
  }),
});

module.exports = {
  createDocumentFileNamingRuleSchema,
  getAllDocumentFileNamingRulesSchema,
  deleteDocumentFileNamingRuleSchema,
  updateDocumentFileNamingRuleParamsSchema,
  updateDocumentFileNamingRuleSchema,
  updateNamingFormatSchema,
};
