const Joi = require("joi");

const createTemplateEmailSignatureSchema = Joi.object({
  include_email_signature: Joi.boolean().default(false),
  signature_content: Joi.alternatives().conditional("include_email_signature", {
  
    otherwise: Joi.forbidden().messages({
      "any.unknown":
        "Signature content is not allowed when include_email_signature is false.",
    }),
  }),
});

const updateTemplateEmailSignatureParamsSchema = Joi.object({
  template_email_signature_id: Joi.string().uuid().required().messages({
    "string.guid": " ID must be a valid UUID",
    "any.required": "ID is required",
  }),
});

const updateTemplateEmailSignatureSchema = Joi.object({
  include_email_signature: Joi.boolean().optional(),
  signature_content: Joi.alternatives().try(
    Joi.string().allow(null, "").optional(),
    Joi.valid(null)
  ),
}).custom((value, helpers) => {
  if (value.include_email_signature === false && value.signature_content) {
    return helpers.error(
      "any.custom",
      "signature_content must be null or empty when include_email_signature is false"
    );
  }
  return value;
}, "Custom logic validation");

module.exports = {
  createTemplateEmailSignatureSchema,
  updateTemplateEmailSignatureParamsSchema,
  updateTemplateEmailSignatureSchema,
};
