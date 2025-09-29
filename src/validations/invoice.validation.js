const Joi = require("joi");

const invoiceStatusEnum = ["draft", "sent", "paid", "overdue", "cancelled"];

const createInvoiceSchema = Joi.object({
  lead_id: Joi.string().uuid().allow(null).optional(),
  description: Joi.string().max(100).required(),
  notes: Joi.string().max(500).required(),
  invoice_amount: Joi.number().precision(2).min(0).default(0),
  due_date: Joi.date().required(),
  status: Joi.string().valid(...invoiceStatusEnum).default("draft"),
  version_number: Joi.number().integer().min(1).default(1),
});

const getInvoicesSchema = Joi.object({
  limit: Joi.number().optional().default(25).max(100),
  offset: Joi.number().optional().default(0),
  lead_id: Joi.string().uuid().optional(),
  status: Joi.string().valid(...invoiceStatusEnum).optional(),
});

module.exports = {
  createInvoiceSchema,
  getInvoicesSchema,
};
