/**
 * Seed default sales_module_settings for a new builder
 */
export async function seedSalesModuleSettings({ company_id, builder_id, created_by, client }) {
  const existing = await client.query(
    `SELECT sales_module_settings_id FROM sales_module_settings
     WHERE (company_id = $1 OR $1 IS NULL) AND (builder_id = $2 OR $2 IS NULL)
     LIMIT 1`,
    [company_id, builder_id],
  );

  if (existing.rowCount === 0) {
    await client.query(
      `INSERT INTO sales_module_settings (
        sales_module_settings_id,
        company_id, 
        builder_id,
        allow_duplicate_leads,
        send_email_on_new_lead,
        show_common_folders,
        lead_mandatory_option,
        role_id,
        sales_won_button_text,
        house_size_unit,
        created_by,
        updated_by
      ) VALUES (gen_random_uuid(), $1, $2, FALSE, TRUE, TRUE, 'email_and_phone', '{}', 'Mark as Won', 'sq_m2', $3, $3)`,
      [company_id, builder_id, created_by],
    );
  }
}

export default { seedSalesModuleSettings };
