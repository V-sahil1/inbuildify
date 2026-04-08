import Joi from "joi";

export const createQuotationSchema = Joi.object({
  leads_id: Joi.string().uuid().required().messages({
    "string.guid": "Lead ID must be a valid UUID",
    "any.required": "Lead ID is required",
  }),
});

export const deleteQuotationSchema = Joi.object({
  quotation_id: Joi.string().uuid().required().messages({
    "string.guid": "Quotation ID must be a valid UUID",
    "any.required": "Quotation ID is required",
  }),
});

export const updateQuotationVersionParamsSchema = Joi.object({
  quotation_version_id: Joi.string().uuid().required().messages({
    "string.guid": "Quotation Version ID must be a valid UUID",
    "any.required": "Quotation Version ID is required",
  }),
});

export const duplicateQuotationVersionSchema = Joi.object({
  quotation_version_id: Joi.string().uuid().required().messages({
    "string.guid": "Quotation Version ID must be a valid UUID",
    "any.required": "Quotation Version ID is required",
  }),
});

export const updateQuotationVersionBodySchema = Joi.object({
  location_id: Joi.string().uuid().optional().allow(null).messages({
    "string.guid": "Location ID must be a valid UUID",
  }),
  range_id: Joi.string().uuid().optional().allow(null).messages({
    "string.guid": "Range ID must be a valid UUID",
  }),
  dwelling_type_id: Joi.string().uuid().optional().allow(null).messages({
    "string.guid": "Dwelling Type ID must be a valid UUID",
  }),
  floor_plan_id: Joi.string().uuid().optional().allow(null).messages({
    "string.guid": "Floor Plan ID must be a valid UUID",
  }),
  facade_id: Joi.string().uuid().optional().allow(null).messages({
    "string.guid": "Facade ID must be a valid UUID",
  }),
  structure_engineer_id: Joi.string().uuid().optional().allow(null).messages({
    "string.guid": "Structure Engineer ID must be a valid UUID",
  }),
  is_approve: Joi.boolean().optional().messages({
    "boolean.base": "is_approve must be a boolean",
  }),
  sketch_number: Joi.number().precision(2).optional().allow(null).messages({
    "number.base": "Sketch number must be a number",
  }),
  package_id: Joi.string().uuid().optional().allow(null).messages({
    "string.guid": "Package ID must be a valid UUID",
  }),
});

export const removePackageFromVersionSchema = Joi.object({
  quotation_version_id: Joi.string().uuid().required().messages({
    "string.guid": "Quotation Version ID must be a valid UUID",
    "any.required": "Quotation Version ID is required",
  }),
  package_id: Joi.string().uuid().required().messages({
    "string.guid": "Package ID must be a valid UUID",
    "any.required": "Package ID is required",
  }),
});

export const compareQuotationVersionsBodySchema = Joi.object({
  versions: Joi.array()
    .items(
      Joi.object({
        quotation_id: Joi.string().uuid().required().messages({
          "string.guid": "Quotation ID must be a valid UUID",
          "any.required": "Quotation ID is required",
        }),
        version_id: Joi.string().uuid().required().messages({
          "string.guid": "Version ID must be a valid UUID",
          "any.required": "Version ID is required",
        }),
      })
    )
    .length(2)
    .required()
    .messages({
      "array.base": "Versions must be an array of length 2",
      "array.length": "You must provide exactly two versions to compare",
      "any.required": "Versions are required",
    }),
  show_all: Joi.boolean().optional().default(true).messages({
    "boolean.base": "show_all must be a boolean",
  }),
});

export const compareQuotationVersionsParamsSchema = Joi.object({
  leads_id: Joi.string().uuid().required().messages({
    "string.guid": "Lead ID must be a valid UUID",
    "any.required": "Lead ID is required",
  }),
});

export default {
  createQuotationSchema,
  deleteQuotationSchema,
  updateQuotationVersionParamsSchema,
  updateQuotationVersionBodySchema,
  duplicateQuotationVersionSchema,
  compareQuotationVersionsParamsSchema,
  compareQuotationVersionsBodySchema,
  removePackageFromVersionSchema
};
