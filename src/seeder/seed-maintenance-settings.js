/**
 * Seed default maintenance_settings for a new builder
 */
export async function seedMaintenanceSettings({ company_id, builder_id, created_by, client }) {
  const existing = await client.query(
    `SELECT maintenance_settings_id FROM maintenance_settings
     WHERE (company_id = $1 OR $1 IS NULL) AND (builder_id = $2 OR $2 IS NULL)
     LIMIT 1`,
    [company_id, builder_id],
  );

  if (existing.rowCount === 0) {
    await client.query(
      `INSERT INTO maintenance_settings (
        maintenance_settings_id,
        company_id, 
        builder_id,
        area_enabled, 
        supplier_enabled,
        allow_completion_without_supplier_response,
        request_date_enabled, 
        task_date_enabled,
        repair_cost_enabled, 
        hours_spent_enabled,
        maintenance_start_date,
        maintenance_period_days,
        maintenance_duration_days,
        supervisor_roles,
        created_by, 
        updated_by
      ) VALUES (gen_random_uuid(), $1, $2, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, 'handover_date', 0, 0, '{}', $3, $3)`,
      [company_id, builder_id, created_by],
    );
  }
}

export default { seedMaintenanceSettings };
