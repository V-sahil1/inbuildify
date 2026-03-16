/**
 * Seed default general_settings for a new builder
 */
async function seedGeneralSettings({ company_id, builder_id, created_by, client }) {
  // general_settings has no unique constraint on (company_id, builder_id)
  const existing = await client.query(
    `SELECT id FROM general_settings
     WHERE (company_id = $1 OR $1 IS NULL) AND (builder_id = $2 OR $2 IS NULL)
     LIMIT 1`,
    [company_id, builder_id],
  );

  if (existing.rowCount === 0) {
    await client.query(
      `INSERT INTO general_settings (
        company_id, builder_id,
        notification_referral_partner, pdf_password_protected,
        round_of_cost, negative_value_show, negative_value_color,
        show_reference_id_in_pdf
      ) VALUES ($1, $2, false, false, false, true, '#FF0000', 'hide_document_id_and_job_id')`,
      [company_id, builder_id],
    );
  }
}

export default { seedGeneralSettings };
