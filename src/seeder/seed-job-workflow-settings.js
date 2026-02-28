/**
 * Seed default job_workflow_settings for a new builder
 */
async function seedJobWorkflowSettings({ company_id, builder_id, created_by, client }) {
  await client.query(
    `INSERT INTO job_workflow_settings (
      company_id, builder_id,
      show_all_tasks_to_all_roles, include_weekend_date,
      include_holiday_date,
      recalculate_estimated_end_dates_future_tasks,
      recalculate_estimated_dates_based_on_actual_changes,
      created_by, updated_by
    ) VALUES ($1, $2, false, false, false, false, false, $3, $3)
    ON CONFLICT (company_id, builder_id) DO NOTHING`,
    [company_id, builder_id, created_by]
  );
}

module.exports = { seedJobWorkflowSettings };
