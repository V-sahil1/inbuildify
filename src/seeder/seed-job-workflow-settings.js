/**
 * Seed default job_workflow_settings for a new builder
 */
export async function seedJobWorkflowSettings({ company_id, builder_id, created_by, client }) {
  const existing = await client.query(
    `SELECT job_workflow_settings_id FROM job_workflow_settings
     WHERE (company_id = $1 OR $1 IS NULL) AND (builder_id = $2 OR $2 IS NULL)
     LIMIT 1`,
    [company_id, builder_id],
  );

  if (existing.rowCount === 0) {
    await client.query(
      `INSERT INTO job_workflow_settings (
        job_workflow_settings_id,
        company_id, 
        builder_id,
        show_all_tasks_to_all_roles, 
        include_weekend_date,
        include_holiday_date,
        recalculate_estimated_end_dates_future_tasks,
        recalculate_estimated_dates_based_on_actual_changes,
        created_by, 
        updated_by
      ) VALUES (gen_random_uuid(), $1, $2, FALSE, FALSE, FALSE, FALSE, FALSE, $3, $3)`,
      [company_id, builder_id, created_by],
    );
  }
}

export default { seedJobWorkflowSettings };
