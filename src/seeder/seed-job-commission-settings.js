/**
 * Seed default job_commission_settings for a new builder
 */
async function seedJobCommissionSettings({ company_id, builder_id, created_by, client }) {
  await client.query(
    `INSERT INTO job_commission_settings (
      company_id, builder_id,
      define_outgoing_commission, define_incoming_commission,
      created_by, updated_by
    ) VALUES ($1, $2, false, false, $3, $3)
    ON CONFLICT (company_id, builder_id) DO NOTHING`,
    [company_id, builder_id, created_by]
  );
}

module.exports = { seedJobCommissionSettings };
