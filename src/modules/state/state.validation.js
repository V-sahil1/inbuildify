import Joi from "joi";

const getStateSchema = Joi.object({
  country_id: Joi.string().uuid().required(),
});

export default {
  getStateSchema,
};
