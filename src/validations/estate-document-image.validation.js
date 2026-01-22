const Joi = require("joi");

/* -----------------------------
   ESTATE IMAGES VALIDATION
------------------------------ */

const getEstateImageSchema = Joi.object({
  estate_id: Joi.string().uuid().required().messages({
    "any.required": "Estate ID is required",
    "string.base": "Estate ID must be a string",
    "string.uuid": "Estate ID must be a valid UUID",
  }),
});

const updateEstateImageParamsSchema = Joi.object({
  id: Joi.string().uuid().required().messages({
    "any.required": "Estate ID is required",
    "string.base": "Estate ID must be a string",
    "string.uuid": "Estate ID must be a valid UUID",
  }),
});

const updateEstateImageSchema = Joi.object({
  image_url: Joi.string().uri().max(500).allow(null, "").optional(),
  imageUrl: Joi.string().uri().max(500).allow(null, "").optional(),
}).or("image_url", "imageUrl"); // At least one must be present

/* -----------------------------
   ESTATE DOCUMENTS VALIDATION
------------------------------ */

const createEstateDocumentSchema = Joi.object({
  estate_id: Joi.string().uuid().required().messages({
    "any.required": "Estate ID is required",
    "string.base": "Estate ID must be a string",
    "string.uuid": "Estate ID must be a valid UUID",
  }),
  document_name: Joi.string().max(255).required().messages({
    "any.required": "Document name is required",
    "string.base": "Document name must be a string",
    "string.max": "Document name must not exceed 255 characters",
  }),
  file_url: Joi.string().uri().max(500).allow(null, "").optional(),
});

const updateEstateDocumentSchema = Joi.object({
  document_name: Joi.string().max(255).optional(),
  file_url: Joi.string().uri().max(500).allow(null, "").optional(),
  fileUrl: Joi.string().uri().max(500).allow(null, "").optional(),
});

module.exports = {
  getEstateImageSchema,
  updateEstateImageParamsSchema,
  updateEstateImageSchema,
  createEstateDocumentSchema,
  updateEstateDocumentSchema,
};
