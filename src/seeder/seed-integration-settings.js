/**
 * Seed default integration_settings for a new builder
 */
export async function seedIntegrationSettings({ company_id, builder_id, created_by, client }) {
  const existing = await client.query(
    `SELECT integration_settings_id FROM integration_settings
     WHERE (company_id = $1 OR $1 IS NULL) AND (builder_id = $2 OR $2 IS NULL)
     LIMIT 1`,
    [company_id, builder_id],
  );

  if (existing.rowCount === 0) {
    await client.query(
      `INSERT INTO integration_settings (
        integration_settings_id,
        company_id, 
        builder_id,
        automatically_send_welcome_email,
        rea_hl_enabled, 
        canibuild_enabled,
        website_hl_enabled, 
        google_enabled,
        assign_leads_if_assignee_not_found,
        always_assign_leads_to,
        created_by, 
        updated_by
      ) VALUES (gen_random_uuid(), $1, $2, FALSE, FALSE, FALSE, FALSE, FALSE, NULL, NULL, $3, $3)`,
      [company_id, builder_id, created_by],
    );
  }
}

export default { seedIntegrationSettings };
