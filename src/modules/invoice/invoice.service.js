import invoiceRepository from "./invoice.repository.js";
import leadsRepository from "../lead/leads.repository.js";

class InvoiceService {
  async createInvoice(invoiceData, builderId, companyId) {
    try {
      const lead = await leadsRepository.getLeadById(invoiceData.leads_id, builderId);
      if (!lead || (lead.builderId !== builderId && lead.companyId !== companyId)) {
        return {
          success: false,
          message: "Lead not found or does not belong to your organization",
        };
      }

      const count = await invoiceRepository.countInvoicesByLead(invoiceData.leads_id);
      const invoiceNumber = count + 1;

      const leadRef = lead.referenceNumber || lead.refrenceNumber || "LD-UNKNOWN";
      const invoiceReferenceNumber = `${leadRef}-I${invoiceNumber}`;

      const invoiceDataWithRef = {
        ...invoiceData,
        reference_number: invoiceReferenceNumber,
      };

      invoiceDataWithRef.status = invoiceData.generate_invoice ? "sent" : "paid";

      const newInvoice = await invoiceRepository.createInvoice(invoiceDataWithRef);

      return {
        success: true,
        data: newInvoice,
        message: invoiceData.generate_invoice
          ? "Invoice generated successfully"
          : "Deposit captured successfully",
      };
    } catch (error) {
      console.error("Invoice generation error in service:", error);
      return {
        success: false,
        message: error.message || "Failed to create invoice/deposit",
      };
    }
  }

  async getInvoicesByLead(leadId, builderId, companyId) {
    try {
      const lead = await leadsRepository.getLeadById(leadId, builderId);
      if (!lead || (lead.builderId !== builderId && lead.companyId !== companyId)) {
        return {
          success: false,
          message: "Lead not found or does not belong to your organization",
        };
      }

      const invoices = await invoiceRepository.getInvoicesByLead(leadId);
      return {
        success: true,
        data: invoices,
        message: "Records fetched successfully",
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async getInvoiceById(invoiceId, builderId, companyId) {
    try {
      const invoice = await invoiceRepository.getInvoiceById(invoiceId);
      if (!invoice) {
        return {
          success: false,
          message: "Invoice/Deposit record not found",
        };
      }

      const lead = await leadsRepository.getLeadById(invoice.leadsId, builderId);
      if (!lead || (lead.builderId !== builderId && lead.companyId !== companyId)) {
        return {
          success: false,
          message: "Access denied: Record does not belong to your organization",
        };
      }

      return {
        success: true,
        data: invoice,
        message: "Record fetched successfully",
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async updateInvoice(invoiceId, updateData, builderId, companyId) {
    try {
      const invoice = await invoiceRepository.getInvoiceById(invoiceId);
      if (!invoice) {
        return {
          success: false,
          message: "Invoice/Deposit record not found",
        };
      }

      const lead = await leadsRepository.getLeadById(invoice.leadsId, builderId);
      if (!lead || (lead.builderId !== builderId && lead.companyId !== companyId)) {
        return {
          success: false,
          message: "Access denied: Record does not belong to your organization",
        };
      }

      const { leads_id, generate_invoice, reference_number, ...allowedUpdates } = updateData;

      if (Object.keys(allowedUpdates).length === 0) {
        return {
          success: false,
          message: "No valid fields provided for update",
        };
      }

      const updatedInvoice = await invoiceRepository.updateInvoice(invoiceId, allowedUpdates);

      return {
        success: true,
        data: updatedInvoice,
        message: "Record updated successfully",
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async deleteInvoice(invoiceId, builderId, companyId) {
    try {
      const invoice = await invoiceRepository.getInvoiceById(invoiceId);
      if (!invoice) {
        return {
          success: false,
          message: "Record not found",
        };
      }

      const lead = await leadsRepository.getLeadById(invoice.leadsId, builderId);
      if (!lead || (lead.builderId !== builderId && lead.companyId !== companyId)) {
        return {
          success: false,
          message: "Access denied: Record does not belong to your organization",
        };
      }

      await invoiceRepository.deleteInvoice(invoiceId);

      return {
        success: true,
        data: null,
        message: "Record deleted successfully",
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
}

export default new InvoiceService();
