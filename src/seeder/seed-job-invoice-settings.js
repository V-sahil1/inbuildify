/**
 * Seed default job_invoice_settings for a new builder
 */
export async function seedJobInvoiceSettings({ company_id, builder_id, created_by, client }) {
  const existing = await client.query(
    `SELECT job_invoice_settings_id FROM job_invoice_settings
     WHERE (company_id = $1 OR $1 IS NULL) AND (builder_id = $2 OR $2 IS NULL)
     LIMIT 1`,
    [company_id, builder_id],
  );

  if (existing.rowCount === 0) {
    await client.query(
      `INSERT INTO job_invoice_settings (
        job_invoice_settings_id,
        company_id, 
        builder_id,
        show_invoice_summary_in_pdf, 
        invoice_terms_days,
        created_by, 
        updated_by
      ) VALUES (gen_random_uuid(), $1, $2, FALSE, 0, $3, $3)`,
      [company_id, builder_id, created_by],
    );
  }
}

export default { seedJobInvoiceSettings };
