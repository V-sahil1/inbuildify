/**
 * Seed default portal_settings for a new builder
 */
async function seedPortalSettings({ company_id, builder_id, created_by, client }) {
  await client.query(
    `INSERT INTO portal_settings (
      company_id, builder_id,
      send_login_credentials_to_customer,
      send_mail_when_portal_inactive,
      show_site_supervisor_details,
      show_balance_to_pay, add_notes_enabled,
      allow_color_selection, show_color_cost,
      show_construction_stages, auto_share_site_images,
      show_progress_tab, publish_packages_to_agent_portal,
      created_by, updated_by
    ) VALUES ($1, $2, false, false, false, false, false, false, false, false, false, false, false, $3, $3)
    ON CONFLICT (company_id, builder_id) DO NOTHING`,
    [company_id, builder_id, created_by]
  );
}

module.exports = { seedPortalSettings };
