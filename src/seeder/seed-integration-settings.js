/**
 * Seed default integration_settings for a new builder
 */
async function seedIntegrationSettings({ company_id, builder_id, created_by, client }) {
  await client.query(
    `INSERT INTO integration_settings (
      company_id, builder_id,
      automatically_send_welcome_email,
      rea_hl_enabled, canibuild_enabled,
      website_hl_enabled, google_enabled,
      created_by, updated_by
    ) VALUES ($1, $2, false, false, false, false, false, $3, $3)
    ON CONFLICT (company_id, builder_id) DO NOTHING`,
    [company_id, builder_id, created_by]
  );
}

module.exports = { seedIntegrationSettings };
