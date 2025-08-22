const Joi = require("joi");

const getAllCategoriesSchema = Joi.object({
  limit: Joi.number().optional().default(25).max(50),
  offset: Joi.number().optional().default(0).max(25),
});

module.exports = {
  getAllCategoriesSchema,
};
