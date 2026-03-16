import Joi from "joi";

const createQuotationSchema = Joi.object({
  leads_id: Joi.string().uuid().required().messages({
    "string.guid": "Lead ID must be a valid UUID",
    "any.required": "Lead ID is required",
  }),
});

const deleteQuotationSchema = Joi.object({
  quotation_id: Joi.string().uuid().required().messages({
    "string.guid": "Quotation ID must be a valid UUID",
    "any.required": "Quotation ID is required",
  }),
});

const updateQuotationVersionParamsSchema = Joi.object({
  quotation_version_id: Joi.string().uuid().required().messages({
    "string.guid": "Quotation Version ID must be a valid UUID",
    "any.required": "Quotation Version ID is required",
  }),
});

const duplicateQuotationVersionSchema = Joi.object({
  quotation_version_id: Joi.string().uuid().required().messages({
    "string.guid": "Quotation Version ID must be a valid UUID",
    "any.required": "Quotation Version ID is required",
  }),
});

const updateQuotationVersionBodySchema = Joi.object({
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
  is_approve: Joi.boolean().optional().messages({
    "boolean.base": "is_approve must be a boolean",
  }),
  sketch_number: Joi.number().precision(2).optional().allow(null).messages({
    "number.base": "Sketch number must be a number",
  }),
});

const compareQuotationVersionsParamsSchema = Joi.object({
  quotation_id: Joi.string().uuid().required().messages({
    "string.guid": "Quotation ID must be a valid UUID",
    "any.required": "Quotation ID is required",
  }),
});

const compareQuotationVersionsQuerySchema = Joi.object({
  version_1: Joi.string().uuid().required().messages({
    "string.guid": "Version 1 ID must be a valid UUID",
    "any.required": "Version 1 ID is required",
  }),
  version_2: Joi.string().uuid().required().messages({
    "string.guid": "Version 2 ID must be a valid UUID",
    "any.required": "Version 2 ID is required",
  }),
  show_all: Joi.boolean().optional().default(true).messages({
    "boolean.base": "show_all must be a boolean",
  }),
});

export default {
  createQuotationSchema,
  deleteQuotationSchema,
  updateQuotationVersionParamsSchema,
  updateQuotationVersionBodySchema,
  duplicateQuotationVersionSchema,
  compareQuotationVersionsParamsSchema,
  compareQuotationVersionsQuerySchema,
};
