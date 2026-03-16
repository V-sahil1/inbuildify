import Joi from "joi";

const updateConstructionEtsRechargeSettingsSchema = Joi.object({
  enable_ets_supplier: Joi.boolean().optional(),
  enable_recharge_supplier: Joi.boolean().optional(),
  signature_section: Joi.boolean().optional(),
});

export default {
  updateConstructionEtsRechargeSettingsSchema,
};
