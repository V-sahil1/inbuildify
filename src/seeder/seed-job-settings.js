/**
 * Seed default job_settings for a new builder
 */
async function seedJobSettings({ company_id, builder_id, created_by, client }) {
  await client.query(
    `INSERT INTO job_settings (
      company_id, builder_id,
      auto_move_to_maintenance, auto_mark_completed,
      auto_archive_after_completion,
      report_status_filter, report_include_date,
      created_by, updated_by
    ) VALUES ($1, $2, false, false, false, 'all', true, $3, $3)
    ON CONFLICT (company_id, builder_id) DO NOTHING`,
    [company_id, builder_id, created_by],
  );
}

export default { seedJobSettings };
