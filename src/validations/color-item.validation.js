const Joi = require("joi");

const getAllColorItemsSchema = Joi.object({
  limit: Joi.number().optional().default(25).max(50),
  offset: Joi.number().optional().default(0).max(1000),
});

const getAllColorItemsParamsSchema = Joi.object({
  color_sub_category_id: Joi.string().uuid().required().messages({
    "string.guid": "Color Sub-Category ID must be a valid UUID",
    "any.required": "Color Sub-Category ID is required",
  }),
});

const createColorItemSchema = Joi.object({
  colorSubCategoryId: Joi.string().uuid().required().messages({
    "string.guid": "Color Sub-Category ID must be a valid UUID",
    "any.required": "Color Sub-Category ID is required",
  }),
  name: Joi.string().required().min(1).max(100),
  code: Joi.string().required().min(1).max(100),
  standard: Joi.boolean().optional(),
  upgrade: Joi.boolean().optional(),
  units: Joi.number().integer().optional().allow(null),
  notes: Joi.string().optional().allow(null, ""),
  highlightNotesOnPdf: Joi.boolean().optional(),
  supplierId: Joi.string().uuid().optional().allow(null),
  image: Joi.string().uri().required().allow(null, ""),
});

const updateColorItemSchema = Joi.object({
  name: Joi.string().optional().min(1).max(100),
  code: Joi.string().optional().min(1).max(100),
  standard: Joi.boolean().optional(),
  upgrade: Joi.boolean().optional(),
  units: Joi.number().integer().optional().allow(null),
  notes: Joi.string().optional().allow(null, ""),
  highlightNotesOnPdf: Joi.boolean().optional(),
  supplierId: Joi.string().uuid().optional().allow(null),
  image: Joi.string().uri().optional().allow(null, ""),
}).min(1).message({ "object.min": "At least one field is required to update" });

const colorItemIdParamSchema = Joi.object({
  color_item_id: Joi.string().uuid().required().messages({
    "string.guid": "Color Item ID must be a valid UUID",
    "any.required": "Color Item ID is required",
  }),
});

module.exports = {
  getAllColorItemsSchema,
  getAllColorItemsParamsSchema,
  createColorItemSchema,
  updateColorItemSchema,
  colorItemIdParamSchema,
};
