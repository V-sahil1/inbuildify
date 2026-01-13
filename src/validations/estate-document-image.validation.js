const Joi = require("joi");

/* -----------------------------
   ESTATE IMAGES VALIDATION
------------------------------ */

const updateEstateImageSchema = Joi.object({
  image_url: Joi.string().uri().max(500).optional(),
});

/* -----------------------------
   ESTATE DOCUMENTS VALIDATION
------------------------------ */

const updateEstateDocumentSchema = Joi.object({
  document_name: Joi.string().max(255).required(),
  file_url: Joi.string().uri().max(500).optional(),
});

module.exports = {
  updateEstateImageSchema,
  updateEstateDocumentSchema,
};
