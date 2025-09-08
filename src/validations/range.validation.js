const Joi = require("joi");

const getAllRangesSchema = Joi.object({
  limit: Joi.number().optional().default(25).max(50),
  offset: Joi.number().optional().default(0).max(25),
});

const createRangeSchema = Joi.object({
  name: Joi.string().required(),
});

const updateRangeSchema = {
  params: Joi.object({
    range_id: Joi.string().uuid().required().messages({
      "string.guid": "Range ID must be a valid UUID",
      "any.required": "Range ID is required",
    }),
  }),
  body: Joi.object({
    name: Joi.string().optional(),
  })
    .min(1)
    .messages({
      "object.min": "At least one field is required to update",
    }),
};

const deleteRangeSchema = {
  params: Joi.object({
    range_id: Joi.string().uuid().required().messages({
      "string.guid": "Range ID must be a valid UUID",
      "any.required": "Range ID is required",
    }),
  }),
};

module.exports = {
  getAllRangesSchema,
  createRangeSchema,
  updateRangeSchema,
  deleteRangeSchema,
};
