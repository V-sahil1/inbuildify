/**
 * Seed default maintenance_settings for a new builder
 */
async function seedMaintenanceSettings({ company_id, builder_id, created_by, client }) {
  await client.query(
    `INSERT INTO maintenance_settings (
      company_id, builder_id,
      area_enabled, supplier_enabled,
      allow_completion_without_supplier_response,
      request_date_enabled, task_date_enabled,
      repair_cost_enabled, hours_spent_enabled,
      maintenance_start_date,
      created_by, updated_by
    ) VALUES ($1, $2, false, false, false, false, false, false, false, 'handover_date', $3, $3)
    ON CONFLICT (company_id, builder_id) DO NOTHING`,
    [company_id, builder_id, created_by],
  );
}

export default { seedMaintenanceSettings };
