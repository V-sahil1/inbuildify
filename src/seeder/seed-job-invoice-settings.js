/**
 * Seed default job_invoice_settings for a new builder
 */
async function seedJobInvoiceSettings({ company_id, builder_id, created_by, client }) {
  await client.query(
    `INSERT INTO job_invoice_settings (
      company_id, builder_id,
      show_invoice_summary_in_pdf, invoice_terms_days,
      created_by, updated_by
    ) VALUES ($1, $2, false, 0, $3, $3)
    ON CONFLICT (company_id, builder_id) DO NOTHING`,
    [company_id, builder_id, created_by]
  );
}

module.exports = { seedJobInvoiceSettings };
