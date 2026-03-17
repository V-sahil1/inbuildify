/**
 * Seed default sales_module_settings for a new builder
 */
export async function seedSalesModuleSettings({ company_id, builder_id, created_by, client }) {
  await client.query(
    `INSERT INTO sales_module_settings (
      company_id, builder_id,
      allow_duplicate_leads, send_email_on_new_lead,
      show_common_folders, lead_mandatory_option,
      sales_won_button_text, house_size_unit,
      created_by, updated_by
    ) VALUES ($1, $2, false, true, true, 'email_and_phone', 'Mark as Won', 'sq_m2', $3, $3)
    ON CONFLICT (company_id, builder_id) DO NOTHING`,
    [company_id, builder_id, created_by],
  );
}

export default { seedSalesModuleSettings };
