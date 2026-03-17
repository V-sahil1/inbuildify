import getPool from "../../config/database.js";
import { keysToCamelCase } from "../../utils/common.js";

class InvoiceRepository {
  constructor() {
    this.pool = getPool();
  }

  async countInvoicesByLead(leadId) {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT COUNT(*) as exact_count
        FROM invoice
        WHERE leads_id = $1
      `;
      const result = await client.query(query, [leadId]);
      return parseInt(result.rows[0].exact_count, 10);
    } finally {
      client.release();
    }
  }

  async createInvoice(invoiceData) {
    const client = await this.pool.connect();
    try {
      const {
        leads_id,
        reference_number,
        generate_invoice,
        invoice_date,
        due_date,
        invoice_amount,
        deposite_date,
        deposite_amount,
        payment_method,
        transaction_no,
        description,
        status,
      } = invoiceData;

      await client.query("BEGIN");

      // 1. Verify existence of the lead
      const leadQuery = "SELECT * FROM leads WHERE leads_id = $1 FOR UPDATE";
      const leadResult = await client.query(leadQuery, [leads_id]);

      if (leadResult.rowCount === 0) {
        throw new Error("Lead not found");
      }

      const lead = leadResult.rows[0];

      // 2. Enforce that Invoices can only be created for Converted Leads
      if (lead.status !== "Convert") {
        throw new Error("Cannot create an invoice for a lead that has not been converted to an opportunity");
      }

      // 3. Insert Invoice
      const query = `
        INSERT INTO invoice (
          leads_id, reference_number, generate_invoice, invoice_date, due_date,
          invoice_amount, deposite_date, deposite_amount, payment_method, 
          transaction_no, description, status
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
        ) RETURNING *
      `;

      const values = [
        leads_id,
        reference_number,
        generate_invoice,
        invoice_date || null,
        due_date || null,
        invoice_amount || null,
        deposite_date || null,
        deposite_amount || null,
        payment_method || null,
        transaction_no || null,
        description || null,
        status || null,
      ];

      const result = await client.query(query, values);
      const newInvoice = result.rows[0];

      // 4. Update Opportunity status to negotiation
      const updateOppQuery = `
        UPDATE opportunity 
        SET status = 'negotiation', updated_at = NOW() 
        WHERE leads_id = $1 AND status != 'closed'
      `;
      await client.query(updateOppQuery, [leads_id]);

      await client.query("COMMIT");
      return keysToCamelCase(newInvoice);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async getInvoicesByLead(leadId) {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT i.*, l.name as lead_name
        FROM invoice i
        LEFT JOIN leads l ON i.leads_id = l.leads_id
        WHERE i.leads_id = $1
        ORDER BY i.created_at DESC
      `;
      const result = await client.query(query, [leadId]);
      return keysToCamelCase(result.rows);
    } finally {
      client.release();
    }
  }

  async getInvoiceById(invoiceId) {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT i.*, l.name as lead_name
        FROM invoice i
        LEFT JOIN leads l ON i.leads_id = l.leads_id
        WHERE i.invoice_id = $1
      `;
      const result = await client.query(query, [invoiceId]);
      return result.rows.length > 0 ? keysToCamelCase(result.rows[0]) : null;
    } finally {
      client.release();
    }
  }

  async updateInvoice(invoiceId, updateData) {
    const client = await this.pool.connect();
    try {
      const fields = [];
      const values = [];
      let paramIndex = 1;

      for (const [key, value] of Object.entries(updateData)) {
        if (value !== undefined) {
          fields.push(`${key} = $${paramIndex++}`);
          values.push(value);
        }
      }

      if (fields.length === 0) {
        throw new Error("No fields provided for update");
      }

      fields.push("updated_at = NOW()");
      values.push(invoiceId);

      const query = `
        UPDATE invoice 
        SET ${fields.join(", ")}
        WHERE invoice_id = $${paramIndex}
        RETURNING *
      `;

      const result = await client.query(query, values);
      return keysToCamelCase(result.rows[0]);
    } finally {
      client.release();
    }
  }

  async deleteInvoice(invoiceId) {
    const client = await this.pool.connect();
    try {
      const query = `
        DELETE FROM invoice 
        WHERE invoice_id = $1
        RETURNING *
      `;
      const result = await client.query(query, [invoiceId]);
      return result.rows.length > 0 ? keysToCamelCase(result.rows[0]) : null;
    } finally {
      client.release();
    }
  }
}

export default new InvoiceRepository();
