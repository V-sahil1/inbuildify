const Joi = require("joi");

const createPackageMapSchema = Joi.object({
  quotation_version_id: Joi.string().uuid().required().messages({
    "string.guid": "Quotation Version ID must be a valid UUID",
    "any.required": "Quotation Version ID is required",
  }),
  package_id: Joi.string().uuid().required().messages({
    "string.guid": "Package ID must be a valid UUID",
    "any.required": "Package ID is required",
  }),
});

const getPackageMapsByVersionSchema = Joi.object({
  quotation_version_id: Joi.string().uuid().required().messages({
    "string.guid": "Quotation Version ID must be a valid UUID",
    "any.required": "Quotation Version ID is required",
  }),
});

const deletePackageMapParamsSchema = Joi.object({
  id: Joi.string().uuid().required().messages({
    "string.guid": "Package Map ID must be a valid UUID",
    "any.required": "Package Map ID is required",
  }),
});

module.exports = {
  createPackageMapSchema,
  getPackageMapsByVersionSchema,
  deletePackageMapParamsSchema,
};
