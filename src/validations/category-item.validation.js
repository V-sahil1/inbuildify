const Joi = require("joi");

const costTypes = ["INCLUDED", "FIXED", "VARIABLE"];
const costOptions = ["NONE", "TBA", "TBC"];
const itemStatuses = ["ACTIVE", "INACTIVE"];

const conditionSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required().messages({
    "string.base": "Condition name must be a string",
    "string.empty": "Condition name is required",
    "any.required": "Condition name is required",
  }),
  range_start: Joi.number().precision(2).required().messages({
    "number.base": "Range start must be a number",
    "any.required": "Range start is required",
  }),
  range_end: Joi.number()
    .precision(2)
    .greater(Joi.ref("range_start"))
    .required()
    .messages({
      "number.base": "Range end must be a number",
      "any.required": "Range end is required",
      "number.greater": "Range end not be greater than range start",
    }),
});

const createCategoryItemSchema = Joi.object({
  category_id: Joi.string().uuid().required().messages({
    "string.guid": "Category ID must be a valid UUID",
    "any.required": "Category ID is required",
  }),
  description: Joi.string().min(2).max(1000).required(),
  short_description: Joi.string().max(500).optional().allow(null, ""),
  cost_type: Joi.string()
    .valid(...costTypes)
    .required(),
  cost: Joi.number().precision(2).optional().allow(null),
  cost_type_text: Joi.string().max(255).optional().allow(null, ""),
  cost_option: Joi.string()
    .valid(...costOptions)
    .default("NONE"),
  include_by_default: Joi.boolean().default(false),
  show_in_hl_package: Joi.boolean().default(true),
  package_only: Joi.boolean().default(false),
  uom: Joi.string().max(50).optional().allow(null, ""),
  sort_order: Joi.number().integer().min(0).default(0),
  range: Joi.string().optional().allow(null),
  dwelling: Joi.string().optional().allow(null),
  conditions: Joi.array()
    .items(conditionSchema)
    .unique((a, b) => a.name === b.name)
    .optional()
    .messages({
      "array.unique": "Each condition must be unique by name",
    }),
  status: Joi.string()
    .valid(...itemStatuses)
    .default("ACTIVE"),
}).custom((value, helpers) => {
  if (value.cost_type === "FIXED") {
    if (!value.cost || Number(value.cost) <= 0) {
      return helpers.error("cost.fixed.required");
    }
  } else if (value.cost_type === "VARIABLE") {
    if (!value.range && !value.dwelling) {
      return helpers.error("cost.variable.rangeOrDwelling");
    }
    if (value.include_by_default === true || value.package_only === true) {
      return helpers.error("cost.variable.flagsForbidden");
    }
  } else if (value.cost_type === "INCLUDED") {
    if (!value.cost_type_text || value.cost_type_text.trim() === "") {
      return helpers.error("cost.included.textRequired");
    }
    if (value.cost_option) {
      return helpers.error("cost.included.optionForbidden");
    }
  }

  return value;
}).messages({
  "cost.fixed.required": "cost is required and > 0 when cost_type is FIXED",
  "cost.variable.rangeOrDwelling": "VARIABLE cost_type requires either range or dwelling",
  "cost.variable.flagsForbidden": "VARIABLE cost_type cannot include include_by_default or package_only",
  "cost.included.textRequired": "cost_type_text is required when cost_type is INCLUDED",
  "cost.included.optionForbidden": "cost_option is not allowed when cost_type is INCLUDED",
});

const getCategoryItemsByCategoryIdSchema = Joi.object({
  status: Joi.string()
    .valid(...itemStatuses)
    .default("ACTIVE"),
});

module.exports = {
  createCategoryItemSchema,
  getCategoryItemsByCategoryIdSchema,
};
