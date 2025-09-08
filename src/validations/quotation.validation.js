const Joi = require("joi");

const createQuotationSchema = Joi.object({
  range: Joi.string().required().messages({
    "string.base": "Range must be a string",
    "any.required": "Range is required",
  }),
  dwellingType: Joi.string().required().messages({
    "string.base": "Dwelling type must be a string",
    "any.required": "Dwelling type is required",
  }),
  leadId: Joi.string().uuid().required().messages({
    "string.guid": "Lead ID must be a valid UUID",
    "any.required": "Lead ID is required",
  }),
  propertyId: Joi.string().uuid().required().messages({
    "string.guid": "Property ID must be a valid UUID",
    "any.required": "Property ID is required",
  }),
  floorPlanId: Joi.string().uuid().required().messages({
    "string.guid": "Floor Plan ID must be a valid UUID",
    "any.required": "Floor Plan ID is required",
  }),
  facadeId: Joi.string().uuid().required().messages({
    "string.guid": "Facade ID must be a valid UUID",
    "any.required": "Facade ID is required",
  }),
  packageId: Joi.string().uuid().required().messages({
    "string.guid": "Package ID must be a valid UUID",
    "any.required": "Package ID is required",
  }),
  notes: Joi.string().optional().max(1000).messages({
    "string.max": "Notes must not exceed 1000 characters",
  }),
  items: Joi.array()
    .items(
      Joi.object({
        itemId: Joi.string().uuid().required().messages({
          "string.guid": "Item ID must be a valid UUID",
          "any.required": "Item ID is required",
        }),
        quantity: Joi.number().integer().min(1).required().messages({
          "number.base": "Quantity must be a number",
          "number.min": "Quantity must be greater than or equal to 1",
          "any.required": "Quantity is required",
        }),
        price: Joi.number().precision(2).required().messages({
          "number.base": "Price must be a number",
          "number.precision": "Price must be a number with 2 decimal places",
          "any.required": "Price is required",
        }),
        total: Joi.number()
          .precision(2)
          .required()
          .custom((value, helpers) => {
            const { quantity, price } = helpers.state.ancestors[0];
            const expected = +(quantity * price).toFixed(2);
            if (value !== expected) {
              return helpers.error("any.invalid", {
                message: `Total (${value}) must equal quantity (${quantity}) * price (${price}) = ${expected}`,
              });
            }
            return value;
          })
          .messages({
            "number.base": "Total must be a number",
            "number.precision": "Total must be a number with 2 decimal places",
            "any.required": "Total is required",
            "any.invalid": "{{#message}}",
          }),
      })
    )
    .min(1)
    .required()
    .messages({
      "array.base": "Items must be an array",
      "array.min": "At least one item is required",
      "any.required": "Items are required",
    }),
});

const getQuotationSchema = Joi.object({
  quotation_id: Joi.string().uuid().required().messages({
    "string.guid": "Quotation ID must be a valid UUID",
    "any.required": "Quotation ID is required",
  }),
});

const getQuotationsSchema = Joi.object({
  leadId: Joi.string().uuid().required().messages({
    "string.guid": "Lead ID must be a valid UUID",
    "any.required": "Lead ID is required",
  }),
  page: Joi.number().integer().required().min(1).default(1).messages({
    "number.base": "Page must be a number",
    "number.min": "Page must be greater than or equal to 1",
    "any.default": "Page is required",
  }),
  limit: Joi.number().integer().required().min(1).default(25).messages({
    "number.base": "Limit must be a number",
    "number.min": "Limit must be greater than or equal to 1",
    "any.default": "Limit is required",
  }),
});

module.exports = {
  createQuotationSchema,
  getQuotationSchema,
  getQuotationsSchema,
};
