const Joi = require("joi");

/* =========================
   Reusable helpers
========================= */

const hexColor = Joi.string()
  .pattern(/^#([0-9A-Fa-f]{3}){1,2}$/)
  .allow(null, "");

const pageHeaderFooterSchema = Joi.object({
  backgroundColor: hexColor,
  fontColor: hexColor.required(),
  fontSize: Joi.number().integer().min(1).required(),
  title: Joi.string().allow("").optional(),
});

const logoSettingsSchema = Joi.object({
  alignment: Joi.string().valid("Left", "Center", "Right").required(),
  height: Joi.number().integer().min(1).required(),
  width: Joi.number().integer().min(1).required(),
  padding: Joi.number().allow(null),
  logo_image: Joi.string().allow(null, ""),
  watermark_image: Joi.string().allow(null, ""),
});

const colorBlockSchema = Joi.object({
  backgroundColor: hexColor,
  fontColor: hexColor,
});

const showDetailsBaseSchema = {
  account: Joi.string().required(),
  address: Joi.string().required(),
  contact: Joi.string().required(),
};

/* =========================
   Format schemas
========================= */

const invoiceFormatSchema = Joi.object({
  showDetails: Joi.object({
    ...showDetailsBaseSchema,
    bankInformation: Joi.string().optional(),
  }).required(),

  pageHeader: pageHeaderFooterSchema.required(),
  pageFooter: pageHeaderFooterSchema.required(),
  logoSettings: logoSettingsSchema.required(),

  listItems: Joi.object({
    header: colorBlockSchema.required(),
    footer: colorBlockSchema.optional(),
  }).optional(),

  bankDetails: Joi.object({
    headerText: Joi.string().required(),
  }).optional(),

  customText: Joi.string().allow("").optional(),
  initialDepositDescription: Joi.string().optional(),
});

const receiptFormatSchema = Joi.object({
  showDetails: Joi.object({
    ...showDetailsBaseSchema,
    bankInformation: Joi.string().optional(),
  }).required(),

  pageHeader: pageHeaderFooterSchema.required(),
  pageFooter: pageHeaderFooterSchema.required(),
  logoSettings: logoSettingsSchema.required(),

  bankDetails: Joi.object({
    headerText: Joi.string().required(),
  }).optional(),

  customText: Joi.string().allow("").optional(),
});

const variationFormatSchema = Joi.object({
  showDetails: Joi.object({
    ...showDetailsBaseSchema,
    bankInformation: Joi.string().optional(),
  }).required(),

  pageHeader: pageHeaderFooterSchema.required(),
  pageFooter: pageHeaderFooterSchema.required(),
  logoSettings: logoSettingsSchema.required(),

  listItems: Joi.object({
    header: colorBlockSchema.optional(),
    footer: colorBlockSchema.optional(),
  }).optional(),

  subItems: Joi.object({
    header: colorBlockSchema.optional(),
    showUnitOption: Joi.string().required(),
  }).optional(),

  bankDetails: Joi.object({
    headerText: Joi.string().required(),
  }).optional(),

  customText: Joi.string().allow("").optional(),
  totalCostCustomText: Joi.string().allow("").optional(),
  enableBuilderSignature: Joi.boolean().required(),
});

const colorFormatSchema = Joi.object({
  showDetails: Joi.object({
    ...showDetailsBaseSchema,
    useLabelInfo: Joi.boolean().optional(),
  }).required(),

  pageHeader: pageHeaderFooterSchema.required(),
  pageFooter: pageHeaderFooterSchema.required(),
  logoSettings: logoSettingsSchema.required(),

  listItems: Joi.object({
    header: colorBlockSchema.optional(),
    footer: colorBlockSchema.optional(),
  }).optional(),

  costTypeStyles: Joi.object({
    standard: colorBlockSchema.required(),
    upgrade: colorBlockSchema.required(),
  }).required(),

  customText: Joi.string().allow("").optional(),
  enableBuilderSignature: Joi.boolean().required(),
});

const maintenanceFormatSchema = Joi.object({
  showDetails: Joi.object(showDetailsBaseSchema).required(),

  pageHeader: pageHeaderFooterSchema.required(),
  pageFooter: pageHeaderFooterSchema.required(),
  logoSettings: logoSettingsSchema.required(),

  listItems: Joi.object({
    header: colorBlockSchema.required(),
  }).optional(),
});

/* =========================
   Root template_json schema
========================= */

const templateJsonSchema = Joi.object({
  invoiceFormat: invoiceFormatSchema.required(),
  receiptFormat: receiptFormatSchema.required(),
  variationFormat: variationFormatSchema.required(),
  colorFormat: colorFormatSchema.required(),
  maintenanceFormat: maintenanceFormatSchema.required(),
}).required();

/* =========================
   API schemas (unchanged)
========================= */

const createTemplatePdfSchema = Joi.object({
  name: Joi.string().max(200).required(),
  template_json: templateJsonSchema,
});

const updateTemplatePdfSchema = Joi.object({
  template_json: templateJsonSchema.optional(),
}).min(1);

module.exports = {
  createTemplatePdfSchema,
  updateTemplatePdfSchema,
};
