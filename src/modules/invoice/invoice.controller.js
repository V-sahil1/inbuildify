const invoiceService = require("./invoice.service");
const { successResponse, errorResponse } = require("../../helper/response");

exports.createInvoice = async (req, res) => {
  try {
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId && !companyId) {
      return errorResponse(res, 401, "Unauthorized: Builder ID or Company ID missing");
    }

    if (req.body.generate_invoice === undefined) {
      req.body.generate_invoice = false;
    }

    const result = await invoiceService.createInvoice(req.body, builderId, companyId);

    if (result.success) {
      return successResponse(res, result.data, result.message);
    } else {
      return errorResponse(res, 400, result.message);
    }
  } catch (error) {
    console.error("Create invoice error:", error);
    return errorResponse(res, 500, "Internal server error");
  }
};

exports.getInvoicesByLead = async (req, res) => {
  try {
    const { leads_id } = req.params;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId && !companyId) {
      return errorResponse(res, 401, "Unauthorized: Builder ID or Company ID missing");
    }

    const result = await invoiceService.getInvoicesByLead(leads_id, builderId, companyId);

    if (result.success) {
      return successResponse(res, result.data, result.message);
    } else {
      return errorResponse(res, 400, result.message);
    }
  } catch (error) {
    console.error("Get invoices error:", error);
    return errorResponse(res, 500, "Internal server error");
  }
};

exports.getInvoiceById = async (req, res) => {
  try {
    const { invoice_id } = req.params;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId && !companyId) {
      return errorResponse(res, 401, "Unauthorized: Builder ID or Company ID missing");
    }

    const result = await invoiceService.getInvoiceById(invoice_id, builderId, companyId);

    if (result.success) {
      return successResponse(res, result.data, result.message);
    } else {
      return errorResponse(res, 404, result.message);
    }
  } catch (error) {
    console.error("Get invoice by ID error:", error);
    return errorResponse(res, 500, "Internal server error");
  }
};

exports.updateInvoice = async (req, res) => {
  try {
    const { invoice_id } = req.params;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId && !companyId) {
      return errorResponse(res, 401, "Unauthorized: Builder ID or Company ID missing");
    }

    const result = await invoiceService.updateInvoice(invoice_id, req.body, builderId, companyId);

    if (result.success) {
      return successResponse(res, result.data, result.message);
    } else {
      return errorResponse(res, 400, result.message);
    }
  } catch (error) {
    console.error("Update invoice error:", error);
    return errorResponse(res, 500, "Internal server error");
  }
};

exports.deleteInvoice = async (req, res) => {
  try {
    const { invoice_id } = req.params;
    const builderId = req.user?.builder_id;
    const companyId = req.user?.company_id;

    if (!builderId && !companyId) {
      return errorResponse(res, 401, "Unauthorized: Builder ID or Company ID missing");
    }

    const result = await invoiceService.deleteInvoice(invoice_id, builderId, companyId);

    if (result.success) {
      return successResponse(res, null, result.message);
    } else {
      return errorResponse(res, 404, result.message);
    }
  } catch (error) {
    console.error("Delete invoice error:", error);
    return errorResponse(res, 500, "Internal server error");
  }
};
