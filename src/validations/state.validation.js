const Joi = require("joi");

const getStateSchema = Joi.object({
  country_id: Joi.string().uuid().required(),
});

module.exports = {
  getStateSchema,
};
