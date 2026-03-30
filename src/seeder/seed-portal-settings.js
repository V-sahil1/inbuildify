/**
 * Seed default portal_settings for a new builder
 */
export async function seedPortalSettings({ company_id, builder_id, created_by, client }) {
  const existing = await client.query(
    `SELECT portal_settings_id FROM portal_settings
     WHERE (company_id = $1 OR $1 IS NULL) AND (builder_id = $2 OR $2 IS NULL)
     LIMIT 1`,
    [company_id, builder_id],
  );

  if (existing.rowCount === 0) {
    await client.query(
      `INSERT INTO portal_settings (
        portal_settings_id,
        company_id, 
        builder_id,
        send_login_credentials_to_customer,
        portal_active_days_after_handover,
        send_mail_when_portal_inactive,
        show_site_supervisor_details,
        show_balance_to_pay, 
        add_notes_enabled,
        allow_color_selection, 
        show_color_cost,
        show_construction_stages, 
        auto_share_site_images,
        show_progress_tab, 
        default_facade_image,
        publish_packages_to_agent_portal,
        created_by, 
        updated_by
      ) VALUES (gen_random_uuid(), $1, $2, FALSE, 0, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, NULL, FALSE, $3, $3)`,
      [company_id, builder_id, created_by],
    );
  }
}

export default { seedPortalSettings };
